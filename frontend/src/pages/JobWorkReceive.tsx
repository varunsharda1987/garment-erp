/**
 * Receive from processor — one delivery, every colour it brought (2026-10-02).
 *
 * The event this page models: a truck comes back from the printer with ONE challan and ONE bill, carrying the Brown
 * fabric for ESSKY090LS and the Red for ESSKY092LS. The truck's details are typed once at the top; below, one row
 * per job line (colour / order) with what came of it. One press files a receipt per colour — each its own fabric
 * lot and inward challan, credited to its own orders — and all of them commit together or none do. A job that
 * brings back one fabric is the same page with one row. Replaces the Receive dialog (which mixed the truck's and
 * each colour's figures in one long scroll).
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Loader2, PackageCheck } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { FoldActualField } from '@/components/FoldActualField';
import ReceiptDetailRows, { type ReceiptEntryMode } from '@/components/job-work/ReceiptDetailRows';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { warehouseService } from '@/services/warehouse.service';
import type { WarehouseType } from '@/types/inventory.types';
import { handleApiError, handleApiSuccess, isOutcomeUnknown } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import { formatDate, toDateInputValue } from '@/lib/date';
import { formatQuantity } from '@/lib/formatters';
import { unitShort } from '@/lib/units';
import { generateId } from '@/lib/utils';
import { invalidateControlCenter } from '@/lib/control-center-keys';
import { lineName } from '@/lib/jwo-lines';
import {
  checkRow,
  deliveryClosesJob,
  deliveryPayload,
  emptyReceiveRow,
  rowActual,
  rowCounted,
  rowEntered,
  rowIsFinal,
  type DeliveryPayload,
  type QualityGrade,
  type ReceiveRow,
} from '@/lib/jwo-receive';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

// A return is booked into a place that holds stock — never a processor's location or "in transit" (owner, 2026-09-19)
const NOT_A_STORE: WarehouseType[] = ['JOB_WORK', 'TRANSIT'];
/** The statuses a job can be received in (the server's JWO_AT_PROCESSOR_STATUSES) */
const RECEIVABLE = ['ISSUED', 'IN_TRANSIT', 'AT_PROCESSOR', 'PARTIALLY_RECEIVED'];

const fmt = (n: number | null | undefined) => (n == null ? '-' : Number(n).toFixed(2));

/** The figures a short close is confirmed on — from the server's preview, or from its refusal */
interface ShortCloseFigures {
  cumulative: number;
  expected: number;
  shortfall: number;
  beyondAllowance: number;
  tolerancePercent: number;
  debitNoteAmount: number | null;
}

export default function JobWorkReceive() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = toDateInputValue(new Date());
  const backTo = `/job-work-orders/${id}`;
  const { cutableWidthDeduction } = useDefaultSettings();

  // ---- The truck: typed once ----------------------------------------------------------------------------------
  const [receivedDate, setReceivedDate] = useState(today);
  const [challanRef, setChallanRef] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceToFollow, setInvoiceToFollow] = useState(false);
  const [toProcessor, setToProcessor] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [remarks, setRemarks] = useState('');

  // ---- Each colour --------------------------------------------------------------------------------------------
  const [rows, setRows] = useState<Record<string, ReceiveRow>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Which colours came on THIS truck. Colours of one job often come back on different days: a colour not ticked
  // is simply not part of this delivery and stays open for a later one. The only open colour is ticked for you.
  const [onTruck, setOnTruck] = useState<Record<string, boolean>>({});
  const rowOf = (lineId: string) => rows[lineId] ?? emptyReceiveRow(lineId);
  const updateRow = (lineId: string, patch: Partial<ReceiveRow>) => {
    setRows((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] ?? emptyReceiveRow(lineId)), ...patch } }));
    setRowErrors((prev) => (prev[lineId] ? { ...prev, [lineId]: '' } : prev));
  };

  // One delivery, one set of receipts — however many times it is sent (a slow server once made six receipts of
  // one delivery). One key per page opening; the server answers a repeat with the receipts it already filed.
  const [submissionKey] = useState(() => generateId());
  const [inFlight, setInFlight] = useState(false);
  const [shortCloseOpen, setShortCloseOpen] = useState(false);
  const [serverShort, setServerShort] = useState<ShortCloseFigures | null>(null);
  // A press that got no answer (timed out): the delivery may be in. The next press re-sends exactly that payload
  // with its key, so the server answers with what it filed — the page is not re-read meanwhile, or a colour the
  // first press closed would drop off the page and leave nothing to press.
  const [unanswered, setUnanswered] = useState<DeliveryPayload | null>(null);
  // A colour the server refused on the last press, with its reason — shown on that colour's row
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const { data: jwo, isLoading } = useQuery({
    queryKey: ['job-work-order', id],
    queryFn: () => jobWorkOrderService.getById(id),
    enabled: !!id,
    // The rows are typed against these figures; a refetch on returning to the tab must not move them underneath
    refetchOnWindowFocus: false,
  });

  // Physical stores only — one store is pre-selected, a choice is never overwritten
  const { data: stores } = useQuery({
    queryKey: ['warehouses', 'physical'],
    queryFn: async () =>
      (await warehouseService.getAll({ isActive: true })).filter((w) => !NOT_A_STORE.includes(w.warehouseType)),
  });
  const storeId = toProcessor ? warehouseId : warehouseId || (stores?.length === 1 ? stores[0].id : '');

  const lines = useMemo(() => jwo?.lines ?? [], [jwo?.lines]);
  const openLines = lines.filter((l) => !l.closedAt);
  const isLace = jwo?.fabricType === 'LACE';
  const uom = jwo?.uom ?? 'MTR';
  const unit = unitShort(uom);
  const processorName = jwo?.processor?.name ?? 'the processor';
  const isOnTruck = (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    return !!line && !line.closedAt && (onTruck[lineId] ?? openLines.length === 1);
  };
  /** The colours of this delivery — only these are checked, counted and sent */
  const truckRows = lines.filter((l) => isOnTruck(l.id)).map((l) => rowOf(l.id));
  const entered = truckRows.filter(rowEntered);
  const tickedEmpty = lines.filter((l) => isOnTruck(l.id) && !rowEntered(rowOf(l.id)));
  const dirty = entered.length > 0 || !!challanRef.trim() || !!invoiceNumber.trim() || !!remarks.trim();
  const { setIsDirty, promptUnsaved, UnsavedDialog } = useUnsavedChanges({
    enabled: dirty,
    onDiscard: () => navigate(backTo),
    title: 'Leave without receiving?',
    description: 'Nothing has been booked yet — what you typed on this page will be lost.',
  });

  // ---- The server's figures: every colour's ceiling, and the loss split on the job's total after this delivery --
  const jobReceivedSoFar = Number(jwo?.qtyReceivedMeters ?? 0);
  const deliveryTotal = entered.reduce((sum, row) => sum + rowActual(row), 0);
  const [previewQty, setPreviewQty] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPreviewQty(Math.round((jobReceivedSoFar + deliveryTotal) * 1000) / 1000), 300);
    return () => clearTimeout(t);
  }, [jobReceivedSoFar, deliveryTotal]);
  const { data: preview } = useQuery({
    queryKey: ['jwo-receive-preview', id, previewQty],
    // The ceilings do not depend on the quantity; before anything is typed ask on the job's own total
    queryFn: () => jobWorkOrderService.getReceivePreview(id, Math.max(previewQty, 0.01)),
    enabled: !!jwo,
  });
  // The job's own allowance, else its process type's (the server falls back the same way)
  const tolerancePercent =
    preview?.tolerancePercent ?? jwo?.tolerancePercent ?? jwo?.processTypeMaster?.tolerancePercent ?? 0;
  const maxOf = (lineId: string) => preview?.lines?.find((l) => l.lineId === lineId)?.maxReceivable ?? null;

  const checks = Object.fromEntries(
    lines.map((l) => [l.id, checkRow(rowOf(l.id), l, { isLace, maxReceivable: maxOf(l.id), tolerancePercent, unit })])
  );
  const closesJob = deliveryClosesJob(lines, truckRows, tolerancePercent);
  const jobShort = closesJob && !!preview?.isOverTolerance;

  // ---- What blocks the press ----------------------------------------------------------------------------------
  const sentDay = jwo?.sentDate ? jwo.sentDate.slice(0, 10) : undefined;
  const dateBeforeSend = !!sentDay && !!receivedDate && receivedDate < sentDay;
  // A date can be typed past the picker's max — the server refuses a future date, so say it here first
  const dateInFuture = !!receivedDate && receivedDate > today;
  const invoiceInFuture = !invoiceToFollow && !!invoiceDate && invoiceDate > today;
  const invoiceReady = invoiceToFollow || (!!invoiceNumber.trim() && !!invoiceDate && !invoiceInFuture);
  const rowsReady =
    entered.length > 0 && tickedEmpty.length === 0 && entered.every((row) => checks[row.lineId]?.problems.length === 0);
  const canSubmit =
    (rowsReady && !!storeId && !!receivedDate && !dateBeforeSend && !dateInFuture && invoiceReady && !inFlight) ||
    (!!unanswered && !inFlight);
  const waitingFor = [
    truckRows.length === 0 && 'tick the colour(s) that came on this truck',
    tickedEmpty.length > 0 && `the metres of ${tickedEmpty.map(lineName).join(', ')}`,
    entered.length > 0 && entered.some((row) => checks[row.lineId]?.problems.length) && 'the colours marked in red',
    !storeId && (toProcessor ? "the next processor's unit" : 'the warehouse'),
    dateBeforeSend && 'a date on or after the day the greige was sent',
    dateInFuture && 'a received date that is not in the future',
    invoiceInFuture && 'an invoice date that is not in the future',
    !invoiceReady && "the processor's invoice (or tick Invoice not received yet)",
  ].filter(Boolean);

  const buildPayload = (shortCloseConfirmed: boolean) =>
    deliveryPayload(
      {
        jobWorkOrderId: id,
        receivedDate,
        receivedChallan: challanRef,
        invoiceNumber,
        invoiceDate,
        invoiceToFollow,
        toProcessor,
        warehouseId: storeId,
        vehicle,
        remarks,
      },
      truckRows,
      lines,
      { tolerancePercent, submissionKey, shortCloseConfirmed }
    );
  const receiveMutation = useMutation({
    mutationFn: (payload: DeliveryPayload) => jobWorkOrderService.receiveDelivery(payload),
    onSettled: () => setInFlight(false),
    onSuccess: (result) => {
      setUnanswered(null);
      const { receipts, onwardChallans, lossSplit, jobClosed } = result.data;
      const abnormal = Number(lossSplit?.qtyAbnormalLoss ?? 0);
      const filed = receipts
        .map((r) => {
          const line = lines.find((l) => l.id === r.lineId);
          return `${r.grnNumber}${lines.length > 1 && line ? ` (${lineName(line)})` : ''}`;
        })
        .join(', ');
      handleApiSuccess(
        result.replayed
          ? `${jwo?.jobWorkNumber ?? 'This delivery'} was already received`
          : `${jwo?.jobWorkNumber ?? 'Job'} received into stock`,
        (result.replayed ? `Filed by the earlier press — nothing was filed again: ${filed}.` : `Receipts ${filed}.`) +
          (onwardChallans.length
            ? ` Challan ${onwardChallans.map((c) => c.challanNumber).join(', ')} to ${onwardChallans[0].toName}.`
            : '') +
          (jobClosed
            ? abnormal > 0
              ? ` The job is complete — ${abnormal.toFixed(2)} ${unit} abnormal loss: a debit note against the processor is needed before it can close.`
              : ' The job is complete.'
            : ' The job stays open for what is still to come.')
      );
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['job-work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['process-pos'] });
      queryClient.invalidateQueries({ queryKey: ['process-po'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-order-reconciliation', id] });
      // Each colour's orders are credited — MRP and the requirement pages move
      queryClient.invalidateQueries({ queryKey: ['mrp'] });
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      // Receiving closes the outward challan and puts fabric in stock: both halves of the Control Center change
      invalidateControlCenter(queryClient);
      setIsDirty(false);
      navigate(backTo);
    },
    onError: (err, payload) => {
      // The server is the authority on a short close: when it refused an unconfirmed one, ask here
      const body = (
        err as {
          response?: {
            data?: { message?: string; details?: Partial<ShortCloseFigures> & { reason?: string; lineId?: string } };
          };
        }
      )?.response?.data;
      const d = body?.details;
      if (d?.reason === 'SHORT_CLOSE_UNCONFIRMED') {
        setServerShort({
          cumulative: Number(d.cumulative ?? 0),
          expected: Number(d.expected ?? 0),
          shortfall: Number(d.shortfall ?? 0),
          beyondAllowance: Number(d.beyondAllowance ?? 0),
          tolerancePercent: Number(d.tolerancePercent ?? 0),
          debitNoteAmount: d.debitNoteAmount == null ? null : Number(d.debitNoteAmount),
        });
        setShortCloseOpen(true);
        return;
      }
      // Timed out / no answer: the server may still be saving — never call that a failure. Pressing again is safe:
      // this page's key makes the server answer with the receipts it already filed.
      if (isOutcomeUnknown(err)) {
        setUnanswered(payload);
        notify.warning('The server is slow — this delivery may still be saving', {
          description:
            'Wait a moment and press Receive into stock again. It is safe: if the first press went in, you are ' +
            'shown those receipts — nothing is filed twice.',
          duration: 15000,
        });
        return;
      }
      setUnanswered(null);
      // One colour refused: mark its row
      const refusedLine = d?.lineId;
      if (refusedLine && body?.message) setRowErrors((prev) => ({ ...prev, [refusedLine]: body.message as string }));
      handleApiError(err, 'Could not receive the delivery');
    },
  });

  const send = (shortCloseConfirmed: boolean) => {
    if (inFlight) return;
    setInFlight(true);
    receiveMutation.mutate(buildPayload(shortCloseConfirmed));
  };
  const handleSubmit = () => {
    if (inFlight) return;
    // The earlier press got no answer: send exactly that again (same key) — the server answers with what it filed
    if (unanswered) {
      setInFlight(true);
      receiveMutation.mutate(unanswered);
      return;
    }
    if (jobShort) {
      setServerShort(null);
      setShortCloseOpen(true);
      return;
    }
    send(false);
  };
  const leave = () => (dirty ? promptUnsaved() : navigate(backTo));

  const shortClose: ShortCloseFigures | null =
    serverShort ??
    (preview && jobShort
      ? {
          cumulative: jobReceivedSoFar + deliveryTotal,
          expected: preview.qtyExpected,
          shortfall: preview.shortfall,
          beyondAllowance: preview.qtyAbnormalLoss,
          tolerancePercent: preview.tolerancePercent,
          debitNoteAmount: preview.debitNoteAmount,
        }
      : null);

  // ---- Not receivable here ------------------------------------------------------------------------------------
  if (isLoading || !jwo) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const notHere =
    jwo.purchaseOrderId != null
      ? `${jwo.jobWorkNumber} was raised on a purchase order — receive it on the GRN form against that order.`
      : uom !== 'MTR'
        ? `${jwo.jobWorkNumber} is piece work (${uom}) — receive it from the job with Receive Material.`
        : jwo.receivedDate || !RECEIVABLE.includes(jwo.jwoStatus)
          ? `${jwo.jobWorkNumber} is ${String(jwo.jwoStatus).toLowerCase().replace(/_/g, ' ')} — there is nothing to receive on it.`
          : openLines.length === 0
            ? `Every colour of ${jwo.jobWorkNumber} is already complete.`
            : null;

  const header = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" onClick={leave} aria-label="Back to the job">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <PackageCheck className="h-6 w-6" />
          Receive from {processorName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {jwo.jobWorkNumber} · {jwo.processType.toLowerCase()} · {fmt(Number(jwo.qtySentMeters))} {unit}{' '}
          {isLace ? 'lace' : 'greige'} sent{jwo.sentDate ? ` on ${formatDate(jwo.sentDate)}` : ''}
          {jobReceivedSoFar > 0 ? ` · ${fmt(jobReceivedSoFar)} ${unit} received so far` : ''}
        </p>
      </div>
    </div>
  );

  if (notHere) {
    return (
      <div className="space-y-6">
        {header}
        <Alert>
          <AlertTitle>Not received here</AlertTitle>
          <AlertDescription>
            {notHere}{' '}
            <Link to={backTo} className="underline">
              Back to the job
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const severalLines = lines.length > 1;
  const enteredSummary = entered
    .map((row) => {
      const line = lines.find((l) => l.id === row.lineId)!;
      const final = rowIsFinal(row, line, tolerancePercent);
      return `${severalLines ? `${lineName(line)} ` : ''}${formatQuantity(rowActual(row), uom)} (${final ? 'final' : 'part'})`;
    })
    .join(' · ');
  const stillOpenAfter = openLines.filter((l) => {
    const row = rowOf(l.id);
    return !(rowEntered(row) && rowIsFinal(row, l, tolerancePercent));
  });
  // What the job expects back: its billable figure, else the sum of its colours' (0 on old jobs → not shown)
  const jobExpected = Number(jwo.qtyBillable ?? lines.reduce((sum, l) => sum + Number(l.qtyExpected ?? 0), 0));

  return (
    <div className="space-y-6 pb-28">
      {header}

      {/* The truck: what the processor's challan and bill say, and where the goods went */}
      <Card>
        <CardHeader>
          <CardTitle>The delivery</CardTitle>
          <CardDescription>
            This truck only — the date, {processorName}&apos;s challan and bill go on the receipt of every colour that
            came on it. A colour that comes on another day is received on its own visit, with that day&apos;s date.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="rcv-date">Date received *</Label>
            <Input
              id="rcv-date"
              type="date"
              min={sentDay}
              max={today}
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
            {dateInFuture && <p className="text-xs text-destructive">{formatDate(receivedDate)} is in the future.</p>}
            {dateBeforeSend && sentDay && (
              <p className="text-xs text-destructive">
                {formatDate(receivedDate)} is before the day the {isLace ? 'lace' : 'greige'} was sent (
                {formatDate(sentDay)}).
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rcv-challan">Their challan no.</Label>
            <Input
              id="rcv-challan"
              value={challanRef}
              maxLength={100}
              onChange={(e) => setChallanRef(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rcv-invoice">Processor&apos;s invoice no.{invoiceToFollow ? '' : ' *'}</Label>
            <Input
              id="rcv-invoice"
              value={invoiceNumber}
              maxLength={100}
              disabled={invoiceToFollow}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rcv-invoice-date">Invoice date{invoiceToFollow ? '' : ' *'}</Label>
            <Input
              id="rcv-invoice-date"
              type="date"
              max={today}
              value={invoiceDate}
              disabled={invoiceToFollow}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
            {invoiceInFuture && <p className="text-xs text-destructive">{formatDate(invoiceDate)} is in the future.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2 md:col-start-3">
            <Checkbox
              checked={invoiceToFollow}
              onCheckedChange={(v) => {
                const ticked = v === true;
                setInvoiceToFollow(ticked);
                if (ticked) {
                  setInvoiceNumber('');
                  setInvoiceDate('');
                }
              }}
            />
            Invoice not received yet — add it later on any one of the receipts (Add invoice)
          </label>

          <div className="space-y-2 md:col-span-4">
            <Label>Goes to *</Label>
            <RadioGroup
              value={toProcessor ? 'processor' : 'store'}
              onValueChange={(v) => {
                setToProcessor(v === 'processor');
                setWarehouseId('');
              }}
              className="flex flex-wrap gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="store" id="rcv-to-store" />
                Our store
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="processor" id="rcv-to-processor" />
                Straight to another processor — {processorName} sent it on instead of to us
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{toProcessor ? "Next processor's unit *" : 'Into warehouse *'}</Label>
            {toProcessor ? (
              <WarehouseCombobox
                key="to-processor"
                value={warehouseId}
                onValueChange={setWarehouseId}
                placeholder="Pick the processor's unit"
                warehouseTypeFilter="JOB_WORK"
              />
            ) : (
              <WarehouseCombobox
                key="to-store"
                value={storeId}
                onValueChange={setWarehouseId}
                placeholder="Select warehouse"
                excludeTypes={NOT_A_STORE}
              />
            )}
            {toProcessor && (
              <p className="text-xs text-muted-foreground">
                Each colour is booked there, held by them, with a challan from {processorName} to them.
              </p>
            )}
          </div>
          {toProcessor && (
            <div className="space-y-2">
              <Label htmlFor="rcv-vehicle">Vehicle (for the challan)</Label>
              <Input id="rcv-vehicle" value={vehicle} maxLength={30} onChange={(e) => setVehicle(e.target.value)} />
            </div>
          )}
          <div className="space-y-2 md:col-span-4">
            <Label htmlFor="rcv-remarks">Remarks</Label>
            <Textarea
              id="rcv-remarks"
              rows={2}
              maxLength={1000}
              value={remarks}
              placeholder="Anything worth keeping about this delivery — kept on each colour's receipt"
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Each colour: its own fabric, its own figures */}
      <Card>
        <CardHeader>
          <CardTitle>What came back</CardTitle>
          <CardDescription>
            {severalLines
              ? 'Tick each colour that came on this truck — colours of one job often come back on different days. A colour not ticked stays open for a later delivery. Each colour that came becomes its own receipt and fabric lot, counted only for its own order.'
              : 'Enter what came back. Open the row for than-, bale- or roll-wise entry, the fold length and quality.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                {severalLines && <TableHead className="w-28">On this truck</TableHead>}
                <TableHead>{severalLines ? 'Colour / order' : 'Expected back'}</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Received so far</TableHead>
                <TableHead className="w-44">This delivery ({unit})</TableHead>
                {!isLace && <TableHead className="w-36">Measured width (&quot;)</TableHead>}
                <TableHead className="w-40">Final for this colour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const row = rowOf(line.id);
                const closed = !!line.closedAt;
                const check = checks[line.id];
                const here = isOnTruck(line.id);
                const open = here && (expanded[line.id] ?? !severalLines);
                const expected = line.qtyExpected != null ? Number(line.qtyExpected) : null;
                const received = Number(line.receivedQty ?? 0);
                const orders = line.requirementLinks
                  .map((link) => link.materialRequirements.orders?.orderNumber)
                  .filter(Boolean)
                  .join(', ');
                const output = line.finishedLace ?? line.finishedFabric;
                const cols = (isLace ? 6 : 7) + (severalLines ? 1 : 0);
                const final = rowIsFinal(row, line, tolerancePercent);
                const lastOpen = openLines.length === 1 || stillOpenAfter.every((l) => l.id === line.id);
                return (
                  <Fragment key={line.id}>
                    <TableRow className={closed ? 'opacity-60' : here ? 'bg-primary/5' : undefined}>
                      <TableCell className="align-top">
                        {here && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={open ? 'Hide details' : 'Than / bale / roll, fold and quality'}
                            onClick={() => setExpanded((prev) => ({ ...prev, [line.id]: !open }))}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                      {severalLines && (
                        <TableCell className="align-top">
                          {!closed && (
                            <label className="flex items-center gap-2 pt-2 text-sm">
                              <Checkbox
                                checked={here}
                                aria-label={`${lineName(line)} came on this truck`}
                                onCheckedChange={(v) => {
                                  setOnTruck((prev) => ({ ...prev, [line.id]: v === true }));
                                  if (v === true)
                                    setExpanded((prev) => ({ ...prev, [line.id]: prev[line.id] ?? false }));
                                }}
                              />
                              {here ? 'Yes' : 'No'}
                            </label>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="align-top">
                        <div className="font-medium">
                          {severalLines
                            ? lineName(line)
                            : (output && ('fabricName' in output ? output.fabricName : output.laceName)) ||
                              lineName(line)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[orders, output && ('fabricCode' in output ? output.fabricCode : output.laceCode)]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {closed && (
                          <div className="text-xs font-medium">
                            {line.closedHow === 'SHORT' ? 'Closed short' : 'Complete'} — nothing more is taken
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap">
                        {expected != null ? formatQuantity(expected, uom) : '-'}
                        {line.expectedShrinkage != null && Number(line.expectedShrinkage) > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {formatQuantity(line.qtySent, uom)} − {Number(line.expectedShrinkage)}%
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap">
                        {received > 0 ? formatQuantity(received, uom) : '-'}
                        {!closed && expected != null && received > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {formatQuantity(Math.max(expected - received, 0), uom)} to come
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {closed ? null : !here ? (
                          <div className="pt-2 text-xs text-muted-foreground">
                            Not on this truck — stays open for a later delivery
                          </div>
                        ) : row.entryMode === 'TOTAL_METERS' ? (
                          <Input
                            type="number"
                            min={0.01}
                            step="any"
                            aria-label={`Metres of ${lineName(line)}`}
                            value={row.qtyMeters > 0 ? row.qtyMeters : ''}
                            onChange={(e) => updateRow(line.id, { qtyMeters: parseFloat(e.target.value) || 0 })}
                          />
                        ) : (
                          <div className="pt-2 text-sm">
                            {rowCounted(row) > 0 ? formatQuantity(rowCounted(row), uom) : '-'}
                            <div className="text-xs text-muted-foreground">
                              {row.pieces.length} {row.entryMode === 'ROLL_WISE' ? 'roll(s)' : 'than(s)'} — below
                            </div>
                          </div>
                        )}
                        {here && maxOf(line.id) != null && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Up to {formatQuantity(Math.max((maxOf(line.id) ?? 0) - received, 0), uom)}
                          </div>
                        )}
                        {here && row.foldLengthCm > 0 && rowCounted(row) > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            = {formatQuantity(rowActual(row), uom)} at L {row.foldLengthCm}
                          </div>
                        )}
                      </TableCell>
                      {!isLace && (
                        <TableCell className="align-top">
                          {here && (
                            <>
                              <Input
                                type="number"
                                min={0.01}
                                step="any"
                                aria-label={`Measured width of ${lineName(line)}`}
                                value={row.widthInches > 0 ? row.widthInches : ''}
                                placeholder={
                                  line.sentWidthInches != null ? `asked ${Number(line.sentWidthInches)}"` : undefined
                                }
                                onChange={(e) => updateRow(line.id, { widthInches: parseFloat(e.target.value) || 0 })}
                              />
                              {row.widthInches > 0 && cutableWidthDeduction != null && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Cutable{' '}
                                  {row.widthInches > cutableWidthDeduction
                                    ? Math.round((row.widthInches - cutableWidthDeduction) * 100) / 100
                                    : row.widthInches}
                                  &quot;
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="align-top">
                        {here && rowEntered(row) && (
                          <label className="flex items-start gap-2 pt-2 text-sm">
                            <Checkbox
                              checked={final}
                              onCheckedChange={(v) => updateRow(line.id, { finalOverride: v === true })}
                              className="mt-0.5"
                            />
                            <span>
                              {final ? (lastOpen ? 'Final — closes the job' : 'Final') : 'Part — more to come'}
                            </span>
                          </label>
                        )}
                      </TableCell>
                    </TableRow>

                    {here && (check.problems.length > 0 || check.shortBy != null || !!rowErrors[line.id]) && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={cols - 1} className="pt-0">
                          {check.problems.length > 0 && (
                            <p className="text-xs text-destructive">{check.problems.join(' · ')}</p>
                          )}
                          {!!rowErrors[line.id] && <p className="text-xs text-destructive">{rowErrors[line.id]}</p>}
                          {check.shortBy != null && check.problems.length === 0 && (
                            <p className="text-xs text-amber-700">
                              Final but {fmt(check.shortBy)} {unit} short of this colour&apos;s {fmt(expected)} {unit}.
                              Untick Final if more is coming — any loss is worked out on the whole job when its last
                              colour is in.
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}

                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={cols - 1}>
                          <RowDetails row={row} uom={uom} onChange={(patch) => updateRow(line.id, patch)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {jobShort && preview && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>This closes the job short</AlertTitle>
          <AlertDescription>
            {fmt(jobReceivedSoFar + deliveryTotal)} {unit} in total against {fmt(preview.qtyExpected)} {unit} expected —{' '}
            {fmt(preview.qtyAbnormalLoss)} {unit} beyond the {fmt(preview.tolerancePercent)}% allowance. A debit note
            against {processorName}
            {preview.debitNoteAmount != null ? ` (about ₹${fmt(preview.debitNoteAmount)})` : ''} will be needed before
            the job can close. You are asked to confirm when you press Receive.
          </AlertDescription>
        </Alert>
      )}

      {unanswered && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>The last press got no answer</AlertTitle>
          <AlertDescription>
            The delivery may already be in. Press Receive into stock again — it sends exactly what you pressed before,
            and if it went in you are shown those receipts. Nothing is filed twice.
          </AlertDescription>
        </Alert>
      )}

      {/* What one press will book */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5 text-sm">
            {entered.length > 0 ? (
              <>
                <div>
                  <span className="font-medium">This delivery:</span> {enteredSummary}
                  {severalLines ? ` — ${entered.length} receipt${entered.length === 1 ? '' : 's'}` : ''}
                </div>
                <div className="text-muted-foreground">
                  The job after this: {formatQuantity(jobReceivedSoFar + deliveryTotal, uom)}
                  {jobExpected > 0 ? ` of ${formatQuantity(jobExpected, uom)}` : ''} —{' '}
                  {closesJob
                    ? 'this closes it'
                    : `stays open${severalLines && stillOpenAfter.length ? ` (${stillOpenAfter.map(lineName).join(', ')} still to come)` : ' for the next delivery'}`}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                {severalLines && truckRows.length === 0
                  ? 'Tick the colour(s) that came on this truck, then enter their metres.'
                  : 'Enter what came back to see what will be booked.'}
              </div>
            )}
            {!canSubmit && waitingFor.length > 0 && entered.length > 0 && (
              <div className="text-xs text-amber-700">Still needed: {waitingFor.join(' · ')}</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={leave} disabled={inFlight}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {inFlight && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Receive into stock
            </Button>
          </div>
        </div>
      </div>

      {/* Close … short? — the one question that must be answered in words before a short final goes in */}
      <ConfirmDialog
        open={shortCloseOpen}
        onOpenChange={setShortCloseOpen}
        title={`Close ${jwo.jobWorkNumber} short?`}
        description={
          shortClose
            ? `With this delivery the job has ${fmt(shortClose.cumulative)} ${unit} of the ${fmt(shortClose.expected)} ` +
              `${unit} expected back from ${processorName} — ${fmt(shortClose.shortfall)} ${unit} short, ` +
              `${fmt(shortClose.beyondAllowance)} ${unit} beyond the ${shortClose.tolerancePercent}% allowance. Confirm ` +
              `only if nothing more is coming from ${processorName} on this job: it closes, the shortfall becomes a ` +
              `loss against them` +
              (shortClose.debitNoteAmount != null
                ? `, and a debit note of about ₹${fmt(shortClose.debitNoteAmount)} is due.`
                : '.') +
              ` If more is on its way, go back and untick Final on a colour.`
            : 'This delivery leaves the job short of what was expected back. Confirm only if nothing more is coming.'
        }
        confirmText="Yes — nothing more is coming, close it short"
        cancelText="Go back"
        variant="destructive"
        isLoading={inFlight}
        onConfirm={() => send(true)}
      />
      <UnsavedDialog />
    </div>
  );
}

/** A colour's details: how it was counted (total or piece by piece), the fold, and its quality */
function RowDetails({
  row,
  uom,
  onChange,
}: {
  row: ReceiveRow;
  uom: string;
  onChange: (patch: Partial<ReceiveRow>) => void;
}) {
  const unit = unitShort(uom);
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <RadioGroup
        value={row.entryMode}
        onValueChange={(v) => onChange({ entryMode: v as ReceiptEntryMode, pieces: [] })}
        className="flex flex-wrap gap-4"
      >
        {(
          [
            ['TOTAL_METERS', 'Total metres'],
            ['THAN_WISE', 'Than-wise'],
            ['BALE_WISE', 'Bale-wise'],
            ['ROLL_WISE', 'Roll-wise'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={value} />
            {label}
          </label>
        ))}
      </RadioGroup>
      {row.entryMode !== 'TOTAL_METERS' && (
        <>
          <p className="text-xs text-muted-foreground">
            The fabric lot keeps these {row.entryMode === 'ROLL_WISE' ? 'rolls' : 'thans'} — cutting picks them later.
            {row.entryMode === 'ROLL_WISE' ? ' Roll No.' : ' Than No.'}
            {row.entryMode === 'BALE_WISE' ? ' and Bale No. are' : ' is'} optional.
          </p>
          <ReceiptDetailRows
            mode={row.entryMode}
            rows={row.pieces}
            onChange={(pieces) => onChange({ pieces })}
            unit={unit}
            withTags
          />
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-5">
        {row.entryMode === 'TOTAL_METERS' && (
          <div className="space-y-1">
            <Label className="text-xs">Than count</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={row.thanCount > 0 ? row.thanCount : ''}
              onChange={(e) => onChange({ thanCount: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Fold length L (cm)</Label>
          <Input
            type="number"
            min={0.01}
            max={999.99}
            step={0.01}
            value={row.foldLengthCm > 0 ? row.foldLengthCm : ''}
            onChange={(e) => onChange({ foldLengthCm: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Actual metres (after L)</Label>
          <FoldActualField counted={rowCounted(row)} foldLengthCm={row.foldLengthCm} unit={uom} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quality</Label>
          <Select
            value={row.qualityGrade || 'none'}
            onValueChange={(v) => onChange({ qualityGrade: (v === 'none' ? '' : v) as QualityGrade })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Not recorded" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not recorded</SelectItem>
              <SelectItem value="A">A - Good</SelectItem>
              <SelectItem value="B">B - Minor Defects</SelectItem>
              <SelectItem value="Reject">Reject</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Defect metres</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={row.defectMeters > 0 ? row.defectMeters : ''}
            onChange={(e) => onChange({ defectMeters: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}
