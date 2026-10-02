// Piece-by-piece entry — thans (optionally bale by bale) or rolls — for a job-work receipt and for
// "Record bales & thans" on a greige lot. Pure UI: the caller owns the rows.
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sumDetailRows } from './receipt-detail-rows';

export type ReceiptEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

/** The piece-by-piece modes: loose thans, thans in bales, or rolls (never baled). */
export type DetailEntryMode = 'THAN_WISE' | 'BALE_WISE' | 'ROLL_WISE';

export interface ReceiptDetailRow {
  /** null for an unbaled than (THAN_WISE) or a roll (ROLL_WISE) */
  baleNumber: number | null;
  meters: number;
  /** Bale number printed on the bale — the same on every than of the bale (only with `withTags`) */
  baleNo?: string;
  /** Tag on the than, or the roll's number (only with `withTags`) */
  thanNo?: string;
}

interface ReceiptDetailRowsProps {
  mode: DetailEntryMode;
  rows: ReceiptDetailRow[];
  onChange: (rows: ReceiptDetailRow[]) => void;
  unit?: string;
  /** Show inputs for the printed bale number and the than tag / roll number */
  withTags?: boolean;
}

export default function ReceiptDetailRows({
  mode,
  rows,
  onChange,
  unit = 'm',
  withTags = false,
}: ReceiptDetailRowsProps) {
  const addPiece = (baleNumber: number | null) => {
    // A new than in a bale inherits the bale's printed number
    const baleNo = baleNumber != null ? rows.find((r) => r.baleNumber === baleNumber)?.baleNo : undefined;
    onChange([...rows, { baleNumber, meters: 0, ...(baleNo ? { baleNo } : {}) }]);
  };
  const addBale = () => {
    const next = rows.reduce((m, r) => Math.max(m, r.baleNumber ?? 0), 0) + 1;
    onChange([...rows, { baleNumber: next, meters: 0 }]);
  };
  const update = (index: number, patch: Partial<ReceiptDetailRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  // The printed bale number belongs to the bale: store it on every than of that bale
  const setBaleNo = (bale: number, baleNo: string) =>
    onChange(rows.map((r) => (r.baleNumber === bale ? { ...r, baleNo } : r)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const pieceRow = (row: ReceiptDetailRow, index: number, label: string, tagLabel: string, indent = false) => (
    <div key={index} className={`flex items-center gap-2 ${indent ? 'pl-4' : ''}`}>
      <span className="text-xs text-muted-foreground w-8">{label}</span>
      <Input
        type="number"
        min={0}
        step="any"
        value={row.meters > 0 ? row.meters : ''}
        onChange={(e) => update(index, { meters: parseFloat(e.target.value) || 0 })}
        className="h-7 w-[110px] text-xs"
        placeholder="Metres"
        aria-label={`Metres of ${label}`}
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
      {withTags && (
        <Input
          value={row.thanNo ?? ''}
          onChange={(e) => update(index, { thanNo: e.target.value })}
          className="h-7 w-[90px] text-xs"
          placeholder={tagLabel}
          maxLength={30}
          aria-label={`${tagLabel} of ${label}`}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive"
        onClick={() => remove(index)}
        aria-label={`Remove ${label}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  const detailSum = rows.length > 0 && (
    <div className="text-xs pt-1">
      <span className="text-muted-foreground">Detail sum:</span>{' '}
      <span className="font-medium">
        {sumDetailRows(rows).toFixed(3)} {unit}
      </span>
    </div>
  );

  if (mode === 'THAN_WISE' || mode === 'ROLL_WISE') {
    const rolls = mode === 'ROLL_WISE';
    return (
      <div className="bg-muted/30 rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            {rolls ? 'Rolls' : 'Thans'} ({rows.length})
          </span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addPiece(null)}>
            <Plus className="h-3 w-3 mr-1" /> {rolls ? 'Add roll' : 'Add than'}
          </Button>
        </div>
        {rows.map((r, i) => pieceRow(r, i, `${rolls ? 'R' : '#'}${i + 1}`, rolls ? 'Roll No.' : 'Than No.'))}
        {detailSum}
      </div>
    );
  }

  // BALE_WISE: group rows by bale, keeping each row's index for edits
  const bales = new Map<number, Array<{ row: ReceiptDetailRow; index: number }>>();
  rows.forEach((row, index) => {
    const bale = row.baleNumber ?? 0;
    if (!bales.has(bale)) bales.set(bale, []);
    bales.get(bale)!.push({ row, index });
  });

  return (
    <div className="bg-muted/30 rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">
          Bales ({bales.size}) · Thans ({rows.length})
        </span>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addBale}>
          <Plus className="h-3 w-3 mr-1" /> Add bale
        </Button>
      </div>
      {Array.from(bales.entries()).map(([bale, entries]) => (
        <div key={bale} className="border rounded-md p-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium">
                Bale {bale} ({entries.length} thans, {sumDetailRows(entries.map((e) => e.row)).toFixed(3)} {unit})
              </span>
              {withTags && (
                <Input
                  value={entries[0]?.row.baleNo ?? ''}
                  onChange={(e) => setBaleNo(bale, e.target.value)}
                  className="h-6 w-[90px] text-xs"
                  placeholder="Bale No."
                  maxLength={30}
                  aria-label={`Bale No. of bale ${bale}`}
                />
              )}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addPiece(bale)}>
              <Plus className="h-3 w-3 mr-1" /> Add than
            </Button>
          </div>
          {entries.map(({ row, index }, t) => pieceRow(row, index, `T${t + 1}`, 'Than No.', true))}
        </div>
      ))}
      {detailSum}
    </div>
  );
}
