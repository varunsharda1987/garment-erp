import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calculator, CheckCircle2, Loader2, PencilLine, Upload } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { formatQuantity } from '@/lib/formatters';
import {
  cadPlanningService,
  type CadCorrectionImpact,
  type CadCorrectionRequest,
} from '@/services/cad-planning.service';
import type { CADGreigeOption, CADSizeBreakdown, CADSizeOption, CADSpreadsheetRow } from '@/types/cad-planning.types';
import type { MarkerReading } from '@/types/cadFile.types';
import { miniMarkerService } from '@/services/miniMarker.service';
import { SizeBreakdownPopup } from './SizeBreakdownPopup';

const PURPOSE_LABEL: Record<string, string> = { COSTING: 'Costing', RAW_MATERIAL_CALCULATION: 'Raw material' };

const sizesLabel = (sizes: CADSizeBreakdown[]) =>
  sizes.length === 0
    ? 'Not set'
    : `${sizes.map((s) => `${s.sizeName}×${s.quantity}`).join(', ')} (${sizes.reduce((n, s) => n + s.quantity, 0)} pcs)`;

/** "(3.82 + 0.05) ÷ 5" — the average's parts, so it can be checked by hand */
const averageParts = (side: {
  layerLengthMeters?: number | null;
  layerMarginMeters?: number | null;
  pieces?: number | null;
}) =>
  side.layerLengthMeters != null && side.pieces
    ? `(${Number(side.layerLengthMeters.toFixed(3))} + ${Number((side.layerMarginMeters ?? 0).toFixed(3))}) ÷ ${side.pieces}`
    : '—';

const money = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatCurrency(v));
const avg = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v.toFixed(4)} m/pc`);

interface CorrectCadDialogProps {
  styleId: string;
  /** The approved CAD row to correct; null closes the dialog */
  row: CADSpreadsheetRow | null;
  sizeOptions: CADSizeOption[];
  availableGreiges: CADGreigeOption[];
  onClose: () => void;
  /** After a correction was made (applied or sent for approval) */
  onDone: () => void;
}

/**
 * Correct CAD — fix an approved CAD row after cost sheets and orders were built on it. The user changes the
 * marker (layer length, sizes), the greige or the width and gives a reason; "Check impact" shows what
 * moves (₹/m and its slab, ₹ per piece, cost sheets, orders and their requirements); "Submit correction"
 * applies it, or sends new cost-sheet versions to an admin when something approved is built on the row.
 */
export function CorrectCadDialog({
  styleId,
  row,
  sizeOptions,
  availableGreiges,
  onClose,
  onDone,
}: CorrectCadDialogProps) {
  if (!row) return null;
  return (
    <CorrectCadForm
      key={row.id}
      styleId={styleId}
      row={row}
      sizeOptions={sizeOptions}
      availableGreiges={availableGreiges}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function CorrectCadForm({
  styleId,
  row,
  sizeOptions,
  availableGreiges,
  onClose,
  onDone,
}: CorrectCadDialogProps & { row: CADSpreadsheetRow }) {
  const [layer, setLayer] = useState<string>(row.layerLengthMeters != null ? String(row.layerLengthMeters) : '');
  const [sizes, setSizes] = useState<CADSizeBreakdown[]>(row.sizeBreakdowns ?? []);
  const [greigeId, setGreigeId] = useState<string | null>(row.greigeId);
  const [width, setWidth] = useState<string>(row.cutableWidth != null ? String(row.cutableWidth) : '');
  const [reason, setReason] = useState('');
  const [sizesOpen, setSizesOpen] = useState(false);
  const [impact, setImpact] = useState<CadCorrectionImpact | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The corrected marker's image (Raw Mat: required when the marker changes) — read on upload
  const [markerFile, setMarkerFile] = useState<{ id: string; fileName: string | null; reading: MarkerReading } | null>(
    null
  );
  const [uploadingMarker, setUploadingMarker] = useState(false);
  const [markerReason, setMarkerReason] = useState('');
  const markerInput = useRef<HTMLInputElement>(null);
  const markerRequiredHere = row.purpose === 'RAW_MATERIAL_CALCULATION';

  // …or an image already uploaded for the style (e.g. one an approved row did not take because it differs)
  const [pickedImageId, setPickedImageId] = useState('');
  const { data: styleImages } = useQuery({
    queryKey: ['miniMarkers', styleId],
    queryFn: () => miniMarkerService.getAll(styleId),
  });
  const pickableImages = (styleImages?.files ?? []).filter((f) => !f.replacedAt && f.id !== markerFile?.id);
  const onPickImage = async () => {
    if (!pickedImageId) return;
    setUploadingMarker(true);
    try {
      const res = await miniMarkerService.linkForCorrection(styleId, row.id, pickedImageId);
      setMarkerFile({ id: res.file.id, fileName: res.file.fileName, reading: res.reading });
      setPickedImageId('');
      invalidate();
      if (res.reading.status === 'READ' || res.reading.status === 'PARTIAL') {
        notify.success('Marker read — use its values, then check the impact');
      } else {
        notify.warning('This image could not be read — submitting will ask for a reason');
      }
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setUploadingMarker(false);
    }
  };

  const onMarkerFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(chosen.type)) {
      notify.error('Only JPG, PNG and PDF files are allowed');
      return;
    }
    setUploadingMarker(true);
    try {
      const res = await miniMarkerService.uploadForCorrection(styleId, row.id, chosen);
      setMarkerFile({ id: res.file.id, fileName: res.file.fileName, reading: res.reading });
      invalidate();
      if (res.reading.status === 'READ' || res.reading.status === 'PARTIAL') {
        notify.success('Marker read — use its values, then check the impact');
      } else {
        notify.warning('The image was kept, but it could not be read — submitting will ask for a reason');
      }
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setUploadingMarker(false);
    }
  };

  // The marker's length, width and sizes into the form; sizes the style does not offer are left out
  const useMarkerValues = () => {
    const r = markerFile?.reading;
    if (!r) return;
    if (r.lengthM !== null) setLayer(String(r.lengthM));
    if (r.widthIn !== null) setWidth(String(r.widthIn));
    if (r.sizes.length > 0) {
      const offered = new Map(sizeOptions.map((s) => [s.name.trim().toUpperCase(), s]));
      setSizes(
        r.sizes
          .filter((s) => offered.size === 0 || offered.has(s.sizeName.toUpperCase()))
          .map((s) => ({
            sizeName: offered.get(s.sizeName.toUpperCase())?.name ?? s.sizeName,
            sizeId: offered.get(s.sizeName.toUpperCase())?.id ?? null,
            quantity: s.quantity,
          }))
      );
    }
    invalidate();
  };

  const greiges = useMemo(
    () => availableGreiges.filter((g) => !row.genericGreigeName || g.genericGreigeName === row.genericGreigeName),
    [availableGreiges, row.genericGreigeName]
  );
  // The same greiges, searchable — plus the row's own greige when it is no longer offered (made inactive),
  // so the box still names it
  const greigeOptions = useMemo(() => {
    const options: ComboboxOption[] = greiges.map((g) => ({
      value: g.id,
      label: g.greigeName,
      searchText: [g.greigeName, g.genericGreigeName, g.supplierName].filter(Boolean).join(' '),
    }));
    if (row.greigeId && row.greigeName && !options.some((o) => o.value === row.greigeId)) {
      options.unshift({ value: row.greigeId, label: row.greigeName });
    }
    return options;
  }, [greiges, row.greigeId, row.greigeName]);
  const greigeName = (id: string | null) => availableGreiges.find((g) => g.id === id)?.greigeName ?? id ?? '—';

  // Only what changed is sent — an omitted field keeps the row's value on the server
  const request = (): CadCorrectionRequest => {
    const req: CadCorrectionRequest = {};
    const layerNum = layer === '' ? null : Number(layer);
    if (layerNum !== null && layerNum !== row.layerLengthMeters) req.layerLengthMeters = layerNum;
    const key = (s: CADSizeBreakdown[]) =>
      [...s]
        .sort((a, b) => a.sizeName.localeCompare(b.sizeName))
        .map((x) => `${x.sizeName}:${x.quantity}`)
        .join(',');
    if (key(sizes) !== key(row.sizeBreakdowns ?? [])) {
      req.sizeBreakdowns = sizes.map((s) => ({ sizeName: s.sizeName, quantity: s.quantity }));
    }
    if (greigeId !== row.greigeId) req.greigeId = greigeId;
    const widthNum = width === '' ? null : Number(width);
    if (widthNum !== null && widthNum !== row.cutableWidth) req.cutableWidth = widthNum;
    if (markerFile) req.markerFileId = markerFile.id;
    return req;
  };

  const invalidate = () => setImpact(null);

  const checkImpact = async () => {
    setChecking(true);
    try {
      setImpact(await cadPlanningService.previewCadCorrection(styleId, row.id, request()));
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const result = await cadPlanningService.submitCadCorrection(styleId, row.id, {
        ...request(),
        reason: reason.trim(),
        ...(markerReason.trim() ? { markerOverrideReason: markerReason.trim() } : {}),
      });
      notify.success(result.message, { duration: 7000 });
      onDone();
      onClose();
    } catch (error) {
      notify.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const markerCheck = impact?.markerCheck;
  const markerMissing = !!markerCheck?.required && !markerCheck.fileId;
  const markerNeedsReason = !!markerCheck?.fileId && markerCheck.differences.length > 0;
  const canSubmit =
    !!impact &&
    !impact.nothingToCorrect &&
    reason.trim().length >= 3 &&
    !markerMissing &&
    (!markerNeedsReason || markerReason.trim().length >= 3) &&
    !submitting &&
    !uploadingMarker;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5" />
            Correct CAD
          </DialogTitle>
          <DialogDescription>
            {PURPOSE_LABEL[row.purpose ?? ''] ?? row.purpose} · {row.componentName ?? row.partName ?? 'Part'} ·{' '}
            {row.greigeName ?? '—'} · {row.cutableWidth ?? '—'}" · now {avg(row.cadAverage)}. Nothing changes until you
            check the impact and submit.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="correct-layer">Layer length (m)</Label>
              <Input
                id="correct-layer"
                type="number"
                step="any"
                min="0"
                value={layer}
                onChange={(e) => {
                  setLayer(e.target.value);
                  invalidate();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Size breakup</Label>
              <Button variant="outline" className="w-full justify-start font-normal" onClick={() => setSizesOpen(true)}>
                <Calculator className="h-4 w-4 mr-2" />
                <span className="truncate">{sizesLabel(sizes)}</span>
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Greige</Label>
              <Combobox
                options={greigeOptions}
                value={greigeId ?? ''}
                onValueChange={(v) => {
                  // Picking the chosen greige again keeps it — a correction changes the greige, never clears it
                  if (!v) return;
                  setGreigeId(v);
                  invalidate();
                }}
                placeholder="Select greige"
                searchPlaceholder="Search greige..."
                emptyText="No greige found."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="correct-width">Cuttable width (in)</Label>
              <Input
                id="correct-width"
                type="number"
                step="any"
                min="0"
                value={width}
                onChange={(e) => {
                  setWidth(e.target.value);
                  invalidate();
                }}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Corrected marker image{' '}
                  {markerRequiredHere ? (
                    <span className="text-muted-foreground font-normal">
                      (needed when the length, sizes or width change)
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-normal">(optional — checked when given)</span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <input
                    ref={markerInput}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={onMarkerFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markerInput.current?.click()}
                    disabled={uploadingMarker}
                  >
                    {uploadingMarker ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1.5" />
                    )}
                    {markerFile ? 'Replace' : 'Upload'}
                  </Button>
                  {markerFile && (markerFile.reading.status === 'READ' || markerFile.reading.status === 'PARTIAL') && (
                    <Button variant="secondary" size="sm" onClick={useMarkerValues}>
                      Use these values
                    </Button>
                  )}
                </div>
              </div>
              {pickableImages.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Select value={pickedImageId} onValueChange={setPickedImageId} disabled={uploadingMarker}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="…or use an uploaded image" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickableImages.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="text-xs">
                          {f.fileName ?? 'image'}
                          {f.cadRow ? ` — on ${f.cadRow.label}` : ' — not on a row'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pickedImageId || uploadingMarker}
                    onClick={onPickImage}
                  >
                    Use
                  </Button>
                </div>
              )}
              {uploadingMarker && (
                <p className="text-xs text-muted-foreground">Reading the marker — about 10 seconds…</p>
              )}
              {markerFile && (
                <p className="text-xs text-muted-foreground">
                  {markerFile.fileName ?? 'image'}:{' '}
                  {markerFile.reading.lengthM !== null
                    ? [
                        `Length ${markerFile.reading.lengthM} m`,
                        markerFile.reading.widthIn !== null ? `Width ${markerFile.reading.widthIn} in` : null,
                        markerFile.reading.sizes
                          .map((s) => (s.quantity > 1 ? `${s.sizeName} ×${s.quantity}` : s.sizeName))
                          .join(', ') || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : 'could not be read'}
                </p>
              )}
              {markerMissing && (
                <p className="text-xs text-destructive">
                  Upload the corrected marker's image — a Raw Mat CAD's values come from its marker.
                </p>
              )}
              {markerNeedsReason && (
                <div className="space-y-1">
                  <p className="text-xs text-warning">The corrected values differ from this image:</p>
                  <ul className="list-disc pl-5 text-xs text-warning">
                    {markerCheck!.differences.map((d) => (
                      <li key={`${d.field}-${d.label}`}>{d.label}</li>
                    ))}
                  </ul>
                  <Textarea
                    rows={2}
                    placeholder="Why are these values right although the image says otherwise?"
                    value={markerReason}
                    onChange={(e) => setMarkerReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="correct-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="correct-reason"
                rows={2}
                placeholder="Why is the CAD being corrected? (kept in the CAD history)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          {impact && <ImpactPanel impact={impact} greigeName={greigeName} />}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={checkImpact} disabled={checking || submitting}>
            {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Check impact
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {impact?.needsApproval ? 'Send for approval' : 'Submit correction'}
          </Button>
        </DialogFooter>

        <SizeBreakdownPopup
          isOpen={sizesOpen}
          onClose={() => setSizesOpen(false)}
          sizeOptions={sizeOptions}
          currentBreakdowns={sizes}
          onSave={(next) => {
            setSizes(next);
            invalidate();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ImpactPanel({
  impact,
  greigeName,
}: {
  impact: CadCorrectionImpact;
  greigeName: (id: string | null) => string;
}) {
  if (impact.nothingToCorrect) {
    return (
      <Alert className="mt-4">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Nothing to correct</AlertTitle>
        <AlertDescription>The CAD and everything built on it already agree.</AlertDescription>
      </Alert>
    );
  }
  const greigeChanged = impact.before.greigeId !== impact.after.greigeId;
  return (
    <div className="mt-4 space-y-3 rounded-md border p-3 text-sm">
      {impact.carryForwardOnly && (
        <p className="text-muted-foreground">
          The CAD already reads these values — this carries them to the cost sheets and orders below.
        </p>
      )}
      <div className="grid gap-1 sm:grid-cols-2">
        <p>
          CAD average: {avg(impact.before.cadAverage)} → <strong>{avg(impact.after.cadAverage)}</strong>
          {impact.after.layerLengthMeters != null && impact.after.pieces ? (
            <span className="block text-xs text-muted-foreground">
              {averageParts(impact.before)} → {averageParts(impact.after)} (layer + margin by rule) ÷ pieces
            </span>
          ) : null}
        </p>
        {greigeChanged && (
          <p>
            Greige: {greigeName(impact.before.greigeId)} → <strong>{greigeName(impact.after.greigeId)}</strong>
          </p>
        )}
        <p>
          Fabric price: {money(impact.before.totalCostPerMeter)}/m →{' '}
          <strong>{money(impact.after.totalCostPerMeter)}/m</strong>
          {impact.costing.slabLabel && (
            <span className="text-muted-foreground">
              {' '}
              (slab {impact.costing.slabLabel}
              {impact.costing.slabMetres !== null ? ` at ${formatQuantity(impact.costing.slabMetres, 'METER', 0)}` : ''}
              )
            </span>
          )}
        </p>
        <p>
          Fabric per piece: {money(impact.fabricCostPerPiece.before)} →{' '}
          <strong>{money(impact.fabricCostPerPiece.after)}</strong>
        </p>
      </div>
      <p className={impact.costing.priceChanged ? 'text-warning' : 'text-muted-foreground'}>
        {!impact.costing.priceChanged
          ? 'The price per metre does not change.'
          : impact.needsApproval
            ? 'The price per metre changes — the admin who approves the new cost sheet version approves the new price too.'
            : 'The price per metre changes, so the fabric price approval is cleared — approve the new price in Costing Options.'}
      </p>
      {impact.costing.notes.map((n) => (
        <p key={n} className="text-muted-foreground">
          {n}
        </p>
      ))}

      {impact.costSheets.length > 0 && (
        <div>
          <p className="font-medium">Cost sheets</p>
          <ul className="list-disc pl-5">
            {impact.costSheets.map((s) => (
              <li key={s.costSheetId}>
                v{s.version} — {PURPOSE_LABEL[s.purpose] ?? s.purpose} (
                {s.approvalStatus === 'APPROVED' ? 'approved' : s.approvalStatus.toLowerCase()}):{' '}
                {s.action === 'NEW_VERSION' ? 'a new version is made for the admin to approve' : 'updated in place'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {impact.orders.length > 0 && (
        <div>
          <p className="font-medium">Orders</p>
          <ul className="list-disc pl-5 space-y-1">
            {impact.orders.map((o) => (
              <li key={o.orderBomId}>
                {o.orderNumber} (BOM v{o.bomVersion}
                {o.locked ? ', locked — skipped until unlocked' : ''}): greige{' '}
                {o.metresBefore !== null ? formatQuantity(o.metresBefore, 'METER') : '—'} →{' '}
                <strong>{o.metresAfter !== null ? formatQuantity(o.metresAfter, 'METER') : '—'}</strong>
                {o.requirements.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {o.requirements.map((r) => `${r.requirementNumber} (${r.state})`).join(', ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-muted-foreground">{impact.cuttingNote}</p>

      {impact.needsApproval ? (
        <Alert className="border-warning/40 bg-warning/10 [&>svg]:text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Needs an admin&apos;s approval</AlertTitle>
          <AlertDescription>
            The CAD stays as it is until an admin approves the new cost sheet version. Then the CAD, its price approval,
            the order BOMs and the requirements update by themselves — requirement numbers stay the same, and where a PO
            or job work already exists you choose whether to order the extra.
          </AlertDescription>
        </Alert>
      ) : (
        <Badge variant="outline">Nothing approved uses this CAD yet — it is corrected straight away.</Badge>
      )}
    </div>
  );
}
