import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  Info,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/api-error-handler';
import { formatDateTime } from '@/lib/date';
import { getUploadUrl } from '@/config/api.config';
import { miniMarkerService } from '@/services/miniMarker.service';
import type { CadRowMarker, MarkerDifference, MarkerImageResult, MarkerReading } from '@/types/cadFile.types';
import type { CADSizeBreakdown, CADSizeOption, CADSpreadsheetRow } from '@/types/cad-planning.types';

const PURPOSE_LABEL: Record<string, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Mat',
  PRODUCTION: 'Production',
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf'];

/** The values a marker image gives a row — what "Use these values" puts into the row's pending edit */
export interface MarkerValuesForRow {
  layerLengthMeters: number | null;
  cutableWidth: number | null;
  /** null = the sizes were not read, leave the row's as they are */
  sizeBreakdowns: CADSizeBreakdown[] | null;
}

interface MarkerImageDialogProps {
  styleId: string;
  /** The CAD row; null closes the dialog */
  row: CADSpreadsheetRow | null;
  marker: CadRowMarker | undefined;
  /** The style's sizes — a marker size the style does not offer is never put on the row */
  sizeOptions: CADSizeOption[];
  /**
   * An approved (or price-approved) row keeps its values: it takes an image only when the image says exactly
   * what it holds, and "Use these values" is not offered. To change its values: Correct…
   */
  approved: boolean;
  /** Nothing can be changed at all (the table is disabled) */
  readOnly: boolean;
  onClose: () => void;
  /** The row's image or reading changed — refresh the table's image states */
  onChanged: () => void;
  onUseValues: (values: MarkerValuesForRow) => void;
}

const sizesText = (sizes: { sizeName: string; quantity: number }[]) =>
  sizes.length === 0
    ? null
    : sizes.map((s) => (s.quantity > 1 ? `${s.sizeName} ×${s.quantity}` : s.sizeName)).join(', ');

const num = (v: number | null | undefined, unit: string) =>
  v === null || v === undefined ? null : `${Number(v.toFixed(3))}${unit ? ` ${unit}` : ''}`;

/**
 * A CAD row's marker image — the Nest EXPERT screenshot (or PDF) its values come from. Upload one (or pick one
 * already uploaded for the style), the server reads it, and the dialog shows what it says beside what the row
 * says. "Use these values" fills the row for the user to Save. Raw Mat and Production rows cannot be saved
 * without one; values that differ from it need a reason (backend helpers/cad-marker.helper.ts).
 */
export function MarkerImageDialog(props: MarkerImageDialogProps) {
  if (!props.row) return null;
  return <MarkerImageBody key={props.row.id} {...props} row={props.row} />;
}

function MarkerImageBody({
  styleId,
  row,
  marker,
  sizeOptions,
  approved,
  readOnly,
  onClose,
  onChanged,
  onUseValues,
}: MarkerImageDialogProps & { row: CADSpreadsheetRow }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'link' | 'reread' | null>(null);
  const [result, setResult] = useState<MarkerImageResult['summary']>(null);
  const queryClient = useQueryClient();
  // An approved row refused an image that differs from it — the image stays in the style's images
  const [approvedRefusal, setApprovedRefusal] = useState<{ message: string; differences: MarkerDifference[] } | null>(
    null
  );

  // The latest answer from an upload / link / reread wins over the table's copy until the table refreshes.
  // An approved row with no image is left as it is (owner, 28-Sep) — shown plainly, not as "Needs image".
  const latest = result ?? marker ?? null;
  const summary =
    latest && approved && (latest.state === 'NEEDS_IMAGE' || latest.state === 'UNUSED')
      ? { ...latest, state: 'NONE' as const }
      : latest;
  const reading: MarkerReading | null = summary?.reading ?? null;
  const file = summary?.file ?? null;
  const differences: MarkerDifference[] = summary?.differences ?? [];
  const differs = (field: MarkerDifference['field']) => differences.some((d) => d.field === field);

  const { data: gallery } = useQuery({
    queryKey: ['miniMarkers', styleId],
    queryFn: () => miniMarkerService.getAll(styleId),
    enabled: !readOnly,
  });
  // The style's images, and this row's earlier ones — picking uses an image at once, so a wrong pick is undone
  // by picking the earlier image again
  const pickable = useMemo(
    () => (gallery?.files ?? []).filter((f) => f.id !== file?.id && (!f.replacedAt || f.cadRow?.id === row.id)),
    [gallery, file?.id, row.id]
  );
  // Only a choice made in the open list counts: a closed Select still picks an item when a letter is typed on
  // it (typeahead), which would replace the row's image with one the user never chose
  const pickerOpen = useRef(false);
  const onPick = (fileId: string) => {
    if (!fileId || !pickerOpen.current || busy) return;
    void run('link', () => miniMarkerService.linkToRow(styleId, row.id, fileId));
  };

  const run = async (kind: 'upload' | 'link' | 'reread', call: () => Promise<MarkerImageResult>) => {
    setBusy(kind);
    setApprovedRefusal(null);
    try {
      const res = await call();
      setResult(res.summary);
      onChanged();
      void queryClient.invalidateQueries({ queryKey: ['miniMarkers', styleId] });
      const state = res.summary?.state;
      if (res.file.readStatus === 'READ' || res.file.readStatus === 'PARTIAL') {
        notify.success(
          state === 'MATCHES'
            ? 'Marker read — the row matches it'
            : state === 'UNUSED'
              ? 'Marker read — click Use these values to fill the row'
              : 'Marker read — check the values'
        );
      } else {
        notify.warning('The image was kept, but it could not be read — saving will ask for a reason');
      }
    } catch (error) {
      const details = (
        error as { response?: { data?: { details?: { code?: string; differences?: MarkerDifference[] } } } }
      )?.response?.data?.details;
      if (details?.code === 'CAD_MARKER_APPROVED_DIFFERS') {
        setApprovedRefusal({
          message: getErrorMessage(error),
          differences: Array.isArray(details.differences) ? details.differences : [],
        });
        notify.warning("The image differs from this approved row — it was kept in the style's images");
        onChanged();
        void queryClient.invalidateQueries({ queryKey: ['miniMarkers', styleId] });
      } else {
        notify.error(getErrorMessage(error));
      }
    } finally {
      setBusy(null);
    }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (!ACCEPTED.includes(chosen.type)) return void notify.error('Only JPG, PNG and PDF files are allowed');
    if (chosen.size > MAX_BYTES) return void notify.error('The file must be smaller than 10 MB');
    void run('upload', () => miniMarkerService.attachToRow(styleId, row.id, chosen));
  };

  // Marker sizes mapped onto the style's sizes; any the style does not offer are named, never added
  const offered = useMemo(() => new Map(sizeOptions.map((s) => [s.name.trim().toUpperCase(), s])), [sizeOptions]);
  const notOffered = (reading?.sizes ?? []).filter((s) => offered.size > 0 && !offered.has(s.sizeName.toUpperCase()));

  const canUse = !readOnly && !approved && !!reading && (reading.status === 'READ' || reading.status === 'PARTIAL');
  const useValues = () => {
    if (!reading) return;
    const sizes =
      reading.sizes.length === 0
        ? null
        : reading.sizes
            .filter((s) => offered.size === 0 || offered.has(s.sizeName.toUpperCase()))
            .map((s) => ({
              sizeName: offered.get(s.sizeName.toUpperCase())?.name ?? s.sizeName,
              sizeId: offered.get(s.sizeName.toUpperCase())?.id ?? null,
              quantity: s.quantity,
            }));
    onUseValues({ layerLengthMeters: reading.lengthM, cutableWidth: reading.widthIn, sizeBreakdowns: sizes });
    onClose();
  };

  const rowSizes = sizesText(row.sizeBreakdowns ?? []);
  const lines: Array<{
    label: string;
    image: string | null;
    row: string | null;
    field?: MarkerDifference['field'];
    calculated?: boolean;
  }> = [
    { label: 'Layer length', image: num(reading?.lengthM, 'm'), row: num(row.layerLengthMeters, 'm'), field: 'length' },
    {
      label: 'Width',
      image: num(reading?.widthIn, 'in'),
      row: row.cutableWidth ? `${row.cutableWidth} in` : null,
      field: 'width',
    },
    { label: 'Sizes', image: reading ? sizesText(reading.sizes) : null, row: rowSizes, field: 'sizes' },
    {
      label: 'Pieces',
      image: reading?.pieces != null ? String(reading.pieces) : null,
      row: row.sizeBreakdowns?.length ? String(row.sizeBreakdowns.reduce((n, s) => n + s.quantity, 0)) : null,
    },
    {
      label: 'Placed',
      image: reading?.placed != null ? `${reading.placed} / ${reading.total}` : null,
      row: null,
      field: 'placed',
    },
    { label: 'Efficiency', image: reading?.efficiencyPct != null ? `${reading.efficiencyPct} %` : null, row: null },
    // Not on the marker: the margin the length rule adds, and the average both give by the same formula
    {
      label: 'Margin (by rule)',
      image: num(summary?.imageMarginM, 'm'),
      // no layer length = no margin yet (not "0 m")
      row: row.layerLengthMeters != null ? num(row.layerMarginMeters, 'm') : null,
      calculated: true,
    },
    {
      label: 'CAD Avg (m/pc)',
      image: summary?.imageAverage != null ? String(summary.imageAverage) : null,
      row: row.cadAverage != null ? String(Number(row.cadAverage.toFixed(4))) : null,
      calculated: true,
    },
  ];

  const isPdf = file?.fileName?.toLowerCase().endsWith('.pdf');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            CAD image
            {summary && <MarkerStateBadge state={summary.state} differences={differences} />}
          </DialogTitle>
          <DialogDescription>
            {PURPOSE_LABEL[row.purpose ?? ''] ?? row.purpose} · {row.componentName ?? '—'}
            {row.partName ? ` · ${row.partName}` : ''} · {row.cutableWidth ? `${row.cutableWidth}"` : 'no width yet'}.{' '}
            {approved
              ? file
                ? 'The marker image of this approved row.'
                : 'Approved before CAD images were required — it keeps its values. Attach its marker image: an approved row takes one only when it says exactly what the row holds.'
              : summary?.required
                ? 'This row is saved from its marker: attach the Nest EXPERT screenshot (or its PDF) and use its values.'
                : 'A Costing row may keep its marker image; when it has one, its values are checked against it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* The image */}
          <div className="space-y-2">
            {file ? (
              <a
                href={getUploadUrl(file.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="block border rounded-md overflow-hidden bg-muted/30 hover:opacity-90"
                title="Open the full image"
              >
                {isPdf ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <FileText className="h-10 w-10" />
                    <span className="text-xs mt-1">PDF — open to view</span>
                  </div>
                ) : (
                  <img
                    src={getUploadUrl(file.fileUrl)}
                    alt={file.fileName ?? 'Marker image'}
                    className="w-full object-contain max-h-72"
                  />
                )}
              </a>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded-md text-muted-foreground text-sm">
                <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                No marker image yet
              </div>
            )}
            {file && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                {file.fileName ?? 'image'} · added {formatDateTime(file.uploadedAt)}
                {reading?.readAt ? ` · read ${formatDateTime(reading.readAt)}` : ''}
              </p>
            )}
            {reading?.title && (
              <p className="text-xs text-muted-foreground truncate" title={reading.title}>
                Title: {reading.title}
              </p>
            )}
          </div>

          {/* What it says vs what the row says */}
          <div className="space-y-3">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-1.5" />
                  <TableHead className="py-1.5">Image</TableHead>
                  <TableHead className="py-1.5">Row</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow
                    key={l.label}
                    className={
                      l.field && differs(l.field) ? 'bg-warning/10' : l.calculated ? 'bg-success-muted/40' : undefined
                    }
                  >
                    <TableCell className="py-1.5 text-muted-foreground">{l.label}</TableCell>
                    <TableCell className="py-1.5 font-medium">{l.image ?? '—'}</TableCell>
                    <TableCell className="py-1.5">{l.row ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {summary?.state === 'MATCHES' && (
              <Alert className="border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle>The row matches its marker</AlertTitle>
              </Alert>
            )}
            {summary?.state === 'UNUSED' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Not used yet</AlertTitle>
                <AlertDescription className="text-xs space-y-0.5">
                  {reading && (reading.status === 'READ' || reading.status === 'PARTIAL') ? (
                    <>
                      <p>
                        Click <strong>Use these values</strong> to fill this row from its image, then save the row.
                      </p>
                      {reading.sizes.length === 0 && (
                        <p>
                          The image gives no sizes — enter them in the row's Sizes cell; saving will ask for a reason.
                        </p>
                      )}
                      {reading.widthIn === null && <p>The image gives no width — enter it in the row.</p>}
                    </>
                  ) : (
                    <p>The image could not be read — enter the row's values; saving will ask for a reason.</p>
                  )}
                </AlertDescription>
              </Alert>
            )}
            {reading?.sizesFrom === 'pieces' && (
              <p className="text-xs text-muted-foreground">
                Sizes read from the piece list under the toolbar — the title bar is not in the screenshot.
              </p>
            )}
            {differences.length > 0 && (
              <Alert className="border-warning/40 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>
                  {summary?.state === 'EXPLAINED'
                    ? 'Differs from the image — saved with a reason'
                    : 'Differs from the image'}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs">
                    {differences.map((d) => (
                      <li key={`${d.field}-${d.label}`}>{d.label}</li>
                    ))}
                  </ul>
                  {summary?.overrideReason && <p className="text-xs mt-1">Reason: {summary.overrideReason}</p>}
                </AlertDescription>
              </Alert>
            )}
            {notOffered.length > 0 && (
              <p className="text-xs text-warning">
                The marker has {notOffered.map((s) => s.sizeName).join(', ')} — this style has no such size, so it is
                not put on the row. Add the size to the style, or save with a reason.
              </p>
            )}
            {approvedRefusal && (
              <Alert className="border-warning/40 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>Not linked — it differs from this approved row</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs">
                    {approvedRefusal.differences.map((d) => (
                      <li key={`${d.field}-${d.label}`}>{d.label}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-1">
                    The image is kept in the style's images. To change the row's values, use Correct… from the row menu
                    and pick it there.
                  </p>
                </AlertDescription>
              </Alert>
            )}
            {approved && !readOnly && (
              <p className="text-xs text-muted-foreground">
                This row is approved and keeps its values: it takes an image only when the image says exactly what the
                row holds. To change the values, use Correct… from the row menu.
              </p>
            )}
          </div>
        </div>

        {busy && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {busy === 'reread' ? 'Reading the marker again' : 'Reading the marker'} — about 10 seconds…
          </p>
        )}

        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <>
                <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={onFile} />
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={!!busy}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  {file ? 'Replace image' : 'Upload image'}
                </Button>
                {pickable.length > 0 && (
                  <Select
                    value=""
                    onValueChange={onPick}
                    onOpenChange={(open) => {
                      pickerOpen.current = open;
                    }}
                    disabled={!!busy}
                  >
                    <SelectTrigger className="h-8 w-56 text-xs">
                      <SelectValue placeholder="…or use an uploaded image" />
                    </SelectTrigger>
                    <SelectContent>
                      {pickable.map((f) => (
                        <SelectItem key={f.id} value={f.id} className="text-xs">
                          {f.fileName ?? 'image'}
                          {f.cadRow?.id === row.id && !f.cadRow.current
                            ? " — this row's earlier image"
                            : f.cadRow
                              ? ` — on ${f.cadRow.label}`
                              : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </>
            )}
            {file && (
              <Button
                variant="ghost"
                size="sm"
                disabled={!!busy}
                onClick={() => run('reread', () => miniMarkerService.reread(styleId, row.id))}
                title="Read the image again"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Read again
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {!readOnly && !approved && (
              <Button onClick={useValues} disabled={!canUse || !!busy || summary?.state === 'MATCHES'}>
                Use these values
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The CAD image state as a small badge — the table cell and the dialog title use the same one */
export function MarkerStateBadge({
  state,
  differences,
}: {
  state: CadRowMarker['state'];
  differences: MarkerDifference[];
}) {
  // "Not checked": every difference is one the image could not check (unreadable, or sizes / width not read)
  const notChecked = differences.length > 0 && differences.every((d) => d.image === null && d.row === null);
  switch (state) {
    case 'UNUSED':
      return (
        <Badge className="bg-muted text-muted-foreground border-border" variant="outline">
          Not used yet
        </Badge>
      );
    case 'MATCHES':
      return (
        <Badge className="bg-success/10 text-success border-success/30" variant="outline">
          Matches
        </Badge>
      );
    case 'EXPLAINED':
      return (
        <Badge className="bg-warning/10 text-warning border-warning/30" variant="outline">
          {notChecked ? 'Not checked' : 'Differs'} · reason given
        </Badge>
      );
    case 'DIFFERS':
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30" variant="outline">
          {notChecked ? 'Not checked' : 'Differs'}
        </Badge>
      );
    case 'NEEDS_IMAGE':
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/30" variant="outline">
          Needs image
        </Badge>
      );
    default:
      return null;
  }
}
