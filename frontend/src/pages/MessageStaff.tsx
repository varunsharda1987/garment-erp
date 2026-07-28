import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Send, Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { whatsappService, type StaffContact } from '@/services/whatsapp.service';
import { useWhatsappStatus, useWhatsappConnect } from '@/hooks/useWhatsapp';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

// Canonical department list (mirrors the dropdown in UserForm.tsx).
const DEPARTMENTS = [
  'Merchandising',
  'Production',
  'Cutting',
  'Stitching',
  'Finishing',
  'Checking',
  'Packing',
  'Quality Control',
  'Inventory',
  'Sales',
  'Accounts',
  'Purchase',
  'Design',
  'Dispatch',
  'Maintenance',
  'HR',
];

export default function MessageStaff() {
  const { data: status } = useWhatsappStatus();
  const connect = useWhatsappConnect();
  const waState = status?.state ?? 'disconnected';
  const isLinked = waState === 'ready';

  const { data: directory = [], isLoading: dirLoading } = useQuery<StaffContact[]>({
    queryKey: ['whatsapp', 'staff-directory'],
    queryFn: whatsappService.getStaffDirectory,
  });

  const [department, setDepartment] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return directory;
    return directory.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [directory, search]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const recipientCount = (department ? 1 : 0) + selectedIds.size; // department counts as "a group"
  const canSend = isLinked && !!text.trim() && (!!department || selectedIds.size > 0) && !sending;

  const onSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const { results } = await whatsappService.messageStaff({
        userIds: selectedIds.size ? Array.from(selectedIds) : undefined,
        department: department || undefined,
        text,
      });
      const ok = results.filter((r) => r.to).length;
      const failed = results.filter((r) => r.error);
      if (ok) {
        toast.success(`Message sent to ${ok} colleague${ok > 1 ? 's' : ''}`);
        setText('');
        setSelectedIds(new Set());
        setDepartment('');
      }
      if (!results.length) {
        toast.error('No recipients with a WhatsApp number were found');
      }
      failed.forEach((f) => toast.error(`${f.label || 'Recipient'}: ${f.error}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Send className="h-6 w-6 text-green-600" /> Message Staff
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a WhatsApp message to a colleague or a whole department. It goes out from your own number.
        </p>
      </div>

      {/* Link status */}
      {!isLinked && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              {waState === 'qr' || waState === 'initializing' || waState === 'authenticated' ? (
                <span className="flex items-center gap-2 text-amber-800">
                  <Loader2 className="h-4 w-4 animate-spin" /> Linking your WhatsApp…{' '}
                  <Link to="/whatsapp" className="font-medium underline">
                    open My WhatsApp
                  </Link>
                </span>
              ) : (
                <span className="text-amber-800">
                  Your WhatsApp isn’t linked yet — you can’t send until you connect it.
                </span>
              )}
            </div>
            {waState === 'disconnected' && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => connect.mutate()} disabled={connect.isPending}>
                  {connect.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Connect
                </Button>
                <Button size="sm" asChild>
                  <Link to="/whatsapp">Open My WhatsApp</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="department">Message a whole department</Label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">— None —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Sends to every active staff member in that department who has a WhatsApp number.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label>Or pick individual staff</Label>
                {selectedIds.size > 0 && <Badge variant="secondary">{selectedIds.size} selected</Badge>}
              </div>
              <Input
                placeholder="Search by name, department or role"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
                {dirLoading ? (
                  <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No staff with a WhatsApp number.{' '}
                    <Link to="/users" className="underline">
                      Add numbers in Users
                    </Link>
                    .
                  </p>
                ) : (
                  filtered.map((u) => (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted"
                    >
                      <Checkbox checked={selectedIds.has(u.id)} onCheckedChange={() => toggle(u.id)} />
                      <span className="flex-1 text-sm">
                        {u.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {u.department || '—'} · {u.role}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Message */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
            />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {department ? `Dept: ${department}` : ''}
                {department && selectedIds.size ? ' + ' : ''}
                {selectedIds.size ? `${selectedIds.size} people` : ''}
                {!recipientCount ? 'No recipients yet' : ''}
              </span>
              <Button onClick={onSend} disabled={!canSend} className="bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="mr-2 h-4 w-4" />
                )}
                Send on WhatsApp
              </Button>
            </div>
            {isLinked && status?.me?.number && (
              <p className="text-xs text-muted-foreground">Sending from your number (+{status.me.number}).</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
