// The stitching rate on a new stitching issue: the last rate given for this style, the costing rate, and
// the rate being given now (owner, 2026-10-03). What was taken in costing is often not what the contractor
// actually agreed, so the rate given is typed every time; the contractor's commission is added on top.
import { IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { amountFor, withCommission } from '@/lib/stitching-rate';
import type { StitchingRateGuide } from '@/types/stitching.types';

interface Props {
  guide: StitchingRateGuide | null;
  loading: boolean;
  /** The operator rate as typed */
  value: string;
  onChange: (value: string) => void;
  pieces: number;
}

function RateLines({
  operator,
  commission,
  total,
  percent,
}: {
  operator: number;
  commission: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-2xl font-bold">
        {formatCurrency(operator)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">/ pc to operators</span>
      </div>
      <div className="text-sm text-muted-foreground">
        + {percent}% commission {formatCurrency(commission)} ={' '}
        <strong className="text-foreground">{formatCurrency(total)}</strong> / pc
      </div>
    </div>
  );
}

export function StitchingRateCard({ guide, loading, value, onChange, pieces }: Props) {
  const percent = guide?.commissionPercent ?? 0;
  const rate = Number(value);
  const hasRate = value.trim() !== '' && Number.isFinite(rate) && rate > 0;
  const given = hasRate ? withCommission(rate, percent) : null;
  const amount = hasRate ? amountFor(pieces, rate, percent) : null;
  const costing = guide?.costing ?? null;
  const last = guide?.lastGiven ?? null;
  const difference = given && costing ? Math.round((given.totalPerPiece - costing.totalPerPiece) * 100) / 100 : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Stitching Rate
        </CardTitle>
        <CardDescription>
          Enter what the operators get per piece. The contractor's commission ({percent}%, set in Settings) is added on
          top. The contractor is paid for the good pieces stitched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading the last and costing rates…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-medium text-muted-foreground">Last rate given</div>
              {last ? (
                <>
                  <RateLines
                    operator={last.operatorRatePerPiece}
                    commission={last.commissionPerPiece}
                    total={last.totalPerPiece}
                    percent={last.commissionPercent}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    {last.issueNumber} · {last.contractorName ?? '—'} · {formatDate(last.issueDate)}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={() => onChange(String(last.operatorRatePerPiece))}
                  >
                    Use this rate
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No earlier stitching issue of this style has a rate.</p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-medium text-muted-foreground">As per costing</div>
              {costing ? (
                <>
                  <RateLines
                    operator={costing.operatorRatePerPiece}
                    commission={Math.round((costing.totalPerPiece - costing.operatorRatePerPiece) * 100) / 100}
                    total={costing.totalPerPiece}
                    percent={percent}
                  />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Cost sheet {costing.label}: stitching {formatCurrency(costing.totalPerPiece)} / pc, commission
                    included
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-xs"
                    onClick={() => onChange(String(costing.operatorRatePerPiece))}
                  >
                    Use this rate
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No approved cost sheet of this style has a stitching cost.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-info/30 bg-info-muted p-4">
              <Label htmlFor="operatorRate" className="mb-2 block text-sm font-medium">
                Rate given now (to operators) *
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">₹</span>
                <Input
                  id="operatorRate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="per piece"
                  className="w-32 text-right"
                />
                <span className="text-sm text-muted-foreground">/ pc</span>
              </div>
              {given && (
                <div className="mt-2 text-sm text-muted-foreground">
                  + {percent}% commission {formatCurrency(given.commissionPerPiece)} ={' '}
                  <strong className="text-foreground">{formatCurrency(given.totalPerPiece)}</strong> / pc
                </div>
              )}
              {difference != null && difference !== 0 && (
                <Badge variant={difference > 0 ? 'destructive' : 'secondary'} className="mt-2">
                  {difference > 0 ? '+' : '−'}
                  {formatCurrency(Math.abs(difference))} / pc {difference > 0 ? 'over' : 'under'} costing
                </Badge>
              )}
              {difference === 0 && (
                <Badge variant="secondary" className="mt-2">
                  Same as costing
                </Badge>
              )}
            </div>
          </div>
        )}

        {amount && pieces > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm">
            <span>
              For the <strong>{pieces}</strong> pieces issued, if all come out good:
            </span>
            <span>operators {formatCurrency(amount.operatorAmount)}</span>
            <span>+ commission {formatCurrency(amount.commissionAmount)}</span>
            <span>
              = <strong>{formatCurrency(amount.totalAmount)}</strong>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
