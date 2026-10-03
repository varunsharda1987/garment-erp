// What a stitching issue pays its contractor: the rate given to the operators, the commission on top,
// the costing rate of the issue's day, and the amount owed for the GOOD pieces recorded so far
// (backend stitching-rate.helper — the server computes every number shown here).
import { IndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/currency';
import type { StitchingIssue } from '@/types/stitching.types';

export function StitchingPaymentCard({ issue, canEdit }: { issue: StitchingIssue; canEdit: boolean }) {
  const p = issue.payment;
  if (!p) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5" />
          Stitching Payment
        </CardTitle>
        <CardDescription>
          The contractor is paid for the good pieces stitched: rate to operators × good pieces, plus the commission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {p.operatorRatePerPiece == null ? (
          <p className="text-sm text-muted-foreground">
            No stitching rate on this issue — it was made before rates were kept.
            {canEdit ? ' Use Edit to enter the rate given.' : ''}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Rate given</div>
              <div className="text-xl font-bold">{formatCurrency(p.operatorRatePerPiece)} / pc</div>
              <div className="text-xs text-muted-foreground">
                + {p.commissionPercent ?? 0}% commission {formatCurrency(p.commissionPerPiece)} ={' '}
                {formatCurrency(p.totalPerPiece)} / pc
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">As per costing</div>
              {p.costingRatePerPiece != null ? (
                <>
                  <div className="text-xl font-bold">{formatCurrency(p.costingRatePerPiece)} / pc</div>
                  <div className="text-xs text-muted-foreground">
                    {issue.costingSheet ? `Cost sheet ${issue.costingSheet.label}, ` : ''}commission included
                  </div>
                  {p.differencePerPiece != null && p.differencePerPiece !== 0 && (
                    <Badge variant={p.differencePerPiece > 0 ? 'destructive' : 'secondary'} className="mt-1">
                      {p.differencePerPiece > 0 ? '+' : '−'}
                      {formatCurrency(Math.abs(p.differencePerPiece))} / pc{' '}
                      {p.differencePerPiece > 0 ? 'over' : 'under'} costing
                    </Badge>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">No costing rate was found on the day of issue</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Good pieces</div>
              <div className="text-xl font-bold text-success">{p.goodPieces}</div>
              {p.defectPieces > 0 && (
                <div className="text-xs text-muted-foreground">{p.defectPieces} defect pieces are not paid</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Owed to contractor</div>
              <div className="text-xl font-bold">{formatCurrency(p.owed?.totalAmount ?? 0)}</div>
              {p.owed && (
                <div className="text-xs text-muted-foreground">
                  operators {formatCurrency(p.owed.operatorAmount)} + commission{' '}
                  {formatCurrency(p.owed.commissionAmount)}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
