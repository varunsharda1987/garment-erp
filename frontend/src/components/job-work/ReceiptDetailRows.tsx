// Than-by-than (optionally bale-by-bale) entry for a job-work receipt. Pure UI: the dialog owns the rows.
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ReceiptEntryMode = 'TOTAL_METERS' | 'THAN_WISE' | 'BALE_WISE';

export interface ReceiptDetailRow {
  /** null for an unbaled than (THAN_WISE) */
  baleNumber: number | null;
  meters: number;
}

interface ReceiptDetailRowsProps {
  mode: 'THAN_WISE' | 'BALE_WISE';
  rows: ReceiptDetailRow[];
  onChange: (rows: ReceiptDetailRow[]) => void;
  unit?: string;
}

export const sumDetailRows = (rows: ReceiptDetailRow[]) => rows.reduce((s, r) => s + (r.meters > 0 ? r.meters : 0), 0);

export default function ReceiptDetailRows({ mode, rows, onChange, unit = 'm' }: ReceiptDetailRowsProps) {
  const addThan = (baleNumber: number | null) => onChange([...rows, { baleNumber, meters: 0 }]);
  const addBale = () => {
    const next = rows.reduce((m, r) => Math.max(m, r.baleNumber ?? 0), 0) + 1;
    onChange([...rows, { baleNumber: next, meters: 0 }]);
  };
  const update = (index: number, meters: number) => onChange(rows.map((r, i) => (i === index ? { ...r, meters } : r)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const thanRow = (row: ReceiptDetailRow, index: number, label: string, indent = false) => (
    <div key={index} className={`flex items-center gap-2 ${indent ? 'pl-4' : ''}`}>
      <span className="text-xs text-muted-foreground w-8">{label}</span>
      <Input
        type="number"
        min={0}
        step={0.001}
        value={row.meters > 0 ? row.meters : ''}
        onChange={(e) => update(index, parseFloat(e.target.value) || 0)}
        className="h-7 w-[110px] text-xs"
        placeholder="Metres"
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive"
        onClick={() => remove(index)}
        aria-label="Remove than"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  if (mode === 'THAN_WISE') {
    return (
      <div className="bg-muted/30 rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Thans ({rows.length})</span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addThan(null)}>
            <Plus className="h-3 w-3 mr-1" /> Add than
          </Button>
        </div>
        {rows.map((r, i) => thanRow(r, i, `#${i + 1}`))}
        {rows.length > 0 && (
          <div className="text-xs pt-1">
            <span className="text-muted-foreground">Detail sum:</span>{' '}
            <span className="font-medium">
              {sumDetailRows(rows).toFixed(3)} {unit}
            </span>
          </div>
        )}
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              Bale {bale} ({entries.length} thans, {sumDetailRows(entries.map((e) => e.row)).toFixed(3)} {unit})
            </span>
            <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={() => addThan(bale)}>
              <Plus className="h-3 w-3 mr-1" /> Add than
            </Button>
          </div>
          {entries.map(({ row, index }, t) => thanRow(row, index, `T${t + 1}`, true))}
        </div>
      ))}
      {rows.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Detail sum:</span>{' '}
          <span className="font-medium">
            {sumDetailRows(rows).toFixed(3)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
