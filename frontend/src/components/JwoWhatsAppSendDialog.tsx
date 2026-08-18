/**
 * Send a Job Work Order on WhatsApp — PDF + summary text, through the logged-in
 * user's own linked WhatsApp (whatsapp-web.js session).
 *
 * Recipients: the processor's number (prefilled from the supplier master, editable),
 * any of the sender's WhatsApp groups, and free-typed numbers. The backend generates
 * the PDF once and fans out to every recipient in one call.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageCircle, Loader2, Users, Plus, X, Search } from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { whatsappService, toWaNumber } from '@/services/whatsapp.service';
import { useWhatsappStatus } from '@/hooks/useWhatsapp';
import type { JobWorkOrder } from '@/types/jobWorkOrder.types';

interface JwoWhatsAppSendDialogProps {
  jwo: JobWorkOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Default summary text — key numbers a processor/group needs at a glance.
 * Labels mirror the database fields: "Greige" = qtySentMeters (raw material issued),
 * "Fabric" = qtyBillable (finished fabric expected back). Non-greige jobs (embroidery
 * pieces etc.) keep the neutral Sent/Expected-back wording.
 */
function buildCaption(jwo: JobWorkOrder): string {
  const isGreigeJob = jwo.fabricType === 'GREIGE';
  const lines = [
    `Job Work Order ${jwo.jobWorkNumber}`,
    `Process: ${jwo.processType}${jwo.processor?.name ? ` — ${jwo.processor.name}` : ''}`,
    `${isGreigeJob ? 'Greige' : 'Sent'}: ${jwo.qtySentMeters.toFixed(2)} ${jwo.uom}`,
  ];
  if (jwo.qtyBillable != null) {
    lines.push(`${isGreigeJob ? 'Fabric' : 'Expected back'}: ${jwo.qtyBillable.toFixed(2)} ${jwo.uom}`);
  }
  if (jwo.expectedShrinkage != null && jwo.expectedShrinkage > 0) {
    lines.push(`Shrinkage: ${jwo.expectedShrinkage}%`);
  }
  // Widths: greige loom width issued; finished width = the stenter target to deliver
  if (jwo.greigeWidthInches != null) {
    lines.push(`Greige Width: ${Number(jwo.greigeWidthInches)}"`);
  }
  if (jwo.sentWidthInches != null) {
    lines.push(`Finished Width: ${Number(jwo.sentWidthInches)}"`);
  }
  if (!jwo.isRateTbd && jwo.agreedRatePerMeter > 0) {
    lines.push(`Rate: ₹${jwo.agreedRatePerMeter}/${jwo.uom}`);
  }
  if (jwo.expectedReturnDate) {
    lines.push(`Need by: ${format(new Date(jwo.expectedReturnDate), 'dd MMM yyyy')}`);
  }
  return lines.join('\n');
}

export function JwoWhatsAppSendDialog({ jwo, open, onOpenChange }: JwoWhatsAppSendDialogProps) {
  const [processorChecked, setProcessorChecked] = useState(false);
  const [processorPhone, setProcessorPhone] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [groupSearch, setGroupSearch] = useState('');
  const [customNumbers, setCustomNumbers] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: waStatus } = useWhatsappStatus();
  const waLinked = waStatus?.state === 'ready';

  // Reset per JWO when the dialog opens
  useEffect(() => {
    if (open && jwo) {
      const normalized = toWaNumber(jwo.processor?.phone);
      setProcessorPhone(normalized ?? jwo.processor?.phone ?? '');
      setProcessorChecked(!!normalized);
      setSelectedGroups(new Set());
      setGroupSearch('');
      setCustomNumbers([]);
      setCustomInput('');
      setCaption(buildCaption(jwo));
    }
  }, [open, jwo]);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: () => whatsappService.getGroups(),
    enabled: open && waLinked,
    staleTime: 60 * 1000,
  });

  const filteredGroups = useMemo(() => {
    const list = groups ?? [];
    const q = groupSearch.trim().toLowerCase();
    return q ? list.filter((g) => g.name.toLowerCase().includes(q)) : list;
  }, [groups, groupSearch]);

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomNumber = () => {
    const normalized = toWaNumber(customInput);
    if (!normalized) {
      handleApiError(new Error('Enter a valid number (10 digits, or with country code)'), 'Invalid number');
      return;
    }
    if (!customNumbers.includes(normalized)) setCustomNumbers((prev) => [...prev, normalized]);
    setCustomInput('');
  };

  const recipients = useMemo(() => {
    if (!jwo) return [];
    const list: Array<{ to: string; label?: string }> = [];
    if (processorChecked) {
      const normalized = toWaNumber(processorPhone);
      if (normalized) list.push({ to: normalized, label: jwo.processor?.name || 'Processor' });
    }
    for (const gid of selectedGroups) {
      const g = (groups ?? []).find((x) => x.id === gid);
      list.push({ to: gid, label: g?.name || 'Group' });
    }
    for (const n of customNumbers) list.push({ to: n, label: `+${n}` });
    return list;
  }, [jwo, processorChecked, processorPhone, selectedGroups, groups, customNumbers]);

  const handleSend = async () => {
    if (!jwo || recipients.length === 0) return;
    try {
      setIsSending(true);
      const result = await whatsappService.sendDocument({
        type: 'jobWorkOrder',
        id: jwo.id,
        caption: caption.trim() || undefined,
        recipients,
      });
      const results = result.results ?? [];
      const failed = results.filter((r) => r.error);
      const okCount = results.length - failed.length;
      if (okCount > 0) {
        handleApiSuccess(
          'Sent on WhatsApp',
          `${jwo.jobWorkNumber} delivered to ${okCount} recipient(s) from your number.`
        );
      }
      failed.forEach((f) => handleApiError(new Error(f.error), `Failed: ${f.label || f.to}`));
      if (failed.length === 0) onOpenChange(false);
    } catch (error) {
      handleApiError(error, 'Failed to send on WhatsApp');
    } finally {
      setIsSending(false);
    }
  };

  if (!jwo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Send {jwo.jobWorkNumber} via WhatsApp
          </DialogTitle>
          <DialogDescription>
            Sends the job work order PDF with a summary message from your own linked WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {!waLinked && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Your WhatsApp isn't linked yet. Open{' '}
            <Link to="/whatsapp" className="font-medium underline">
              My WhatsApp
            </Link>{' '}
            and scan the QR first.
          </div>
        )}

        <div className="space-y-4">
          {/* Processor */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Processor</Label>
            <div className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={processorChecked}
                disabled={!toWaNumber(processorPhone)}
                onCheckedChange={(v) => setProcessorChecked(v === true)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{jwo.processor?.name || 'Processor'}</div>
                <Input
                  type="tel"
                  className="h-7 mt-1 text-xs"
                  placeholder="Phone with country code (e.g. 9198…)"
                  value={processorPhone}
                  onChange={(e) => {
                    setProcessorPhone(e.target.value);
                    if (!toWaNumber(e.target.value)) setProcessorChecked(false);
                  }}
                />
                {!jwo.processor?.phone && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    No phone on the supplier master — type one, or add it there for next time.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Users className="h-4 w-4" /> Groups
            </Label>
            {waLinked ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 pl-7 text-sm"
                    placeholder="Search groups..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                  {groupsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading your groups…
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      {groupSearch ? 'No groups match the search.' : 'No groups found on your WhatsApp.'}
                    </div>
                  ) : (
                    filteredGroups.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox checked={selectedGroups.has(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
                        <span className="truncate">{g.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Link WhatsApp to pick from your groups.</p>
            )}
          </div>

          {/* Custom numbers */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Other numbers</Label>
            <div className="flex gap-2">
              <Input
                type="tel"
                className="h-8 text-sm"
                placeholder="10-digit or with country code"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomNumber();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addCustomNumber}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {customNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {customNumbers.map((n) => (
                  <Badge key={n} variant="secondary" className="gap-1">
                    +{n}
                    <button
                      type="button"
                      onClick={() => setCustomNumbers((prev) => prev.filter((x) => x !== n))}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Message</Label>
            <Textarea rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} className="text-sm" />
            <p className="text-[10px] text-muted-foreground">Sent as the caption of the PDF attachment.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!waLinked || recipients.length === 0 || isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4 mr-2" />
                Send to {recipients.length || '…'} recipient{recipients.length === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
