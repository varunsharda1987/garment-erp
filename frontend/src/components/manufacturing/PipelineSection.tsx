/**
 * What is actually in production, and what is stopping the rest.
 *
 * The Control Center was an exceptions inbox only, so an empty factory rendered as a green
 * "All Clear!". This section says what is really happening — and distinguishes the four states
 * that used to look identical: loading, failed, nothing queued, and everything clear.
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle, Factory, Info } from 'lucide-react';
import { resolveBlockerRoute } from '@/lib/blocker-routes';
import type { PipelineBlocker, PipelineOrder, PipelineResponse } from '@/services/manufacturingAlerts.service';

interface PipelineSectionProps {
  data: PipelineResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

/** Blocker chip. CRITICAL must render as critical — the shared BlockerTags has no such case. */
function BlockerChip({ blocker }: { blocker: PipelineBlocker }) {
  const style =
    blocker.severity === 'CRITICAL'
      ? 'bg-destructive/10 text-destructive border-destructive/25'
      : blocker.severity === 'HIGH'
        ? 'bg-warning/10 text-warning border-warning/25'
        : 'bg-muted text-muted-foreground border-border';

  const Icon = blocker.severity === 'CRITICAL' ? AlertOctagon : blocker.severity === 'HIGH' ? AlertTriangle : Info;

  return (
    <Badge variant="outline" className={`${style} gap-1 font-normal`} title={blocker.message}>
      <Icon className="h-3 w-3 shrink-0" />
      {blocker.type.replace(/_/g, ' ').toLowerCase()}
    </Badge>
  );
}

function DeliveryCell({ order }: { order: PipelineOrder }) {
  if (!order.expectedDeliveryDate) return <span className="text-muted-foreground">—</span>;

  const late = order.daysToDelivery != null && order.daysToDelivery < 0;
  const soon = order.daysToDelivery != null && order.daysToDelivery >= 0 && order.daysToDelivery <= 7;

  return (
    <div className="text-sm">
      <div className={late ? 'text-destructive font-medium' : soon ? 'text-warning font-medium' : ''}>
        {order.expectedDeliveryDate}
      </div>
      {order.daysToDelivery != null && (
        <div className={`text-xs ${late ? 'text-destructive' : 'text-muted-foreground'}`}>
          {late
            ? `${Math.abs(order.daysToDelivery)} ${Math.abs(order.daysToDelivery) === 1 ? 'day' : 'days'} late`
            : order.daysToDelivery === 0
              ? 'due today'
              : `in ${order.daysToDelivery} ${order.daysToDelivery === 1 ? 'day' : 'days'}`}
        </div>
      )}
    </div>
  );
}

export function PipelineSection({ data, isLoading, error, onRetry }: PipelineSectionProps) {
  const navigate = useNavigate();

  const body = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    }

    // An error must never look like good news.
    if (error) {
      return (
        <div className="p-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Couldn't load the pipeline</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              <span>{error.message}</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (!data) return null;

    // Nothing queued is NOT "all clear" — an idle factory is a neutral fact, not good news, so it
    // gets a muted icon rather than the green tick.
    if (data.orders.length === 0) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <Factory className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium text-foreground">No open production orders</p>
          <p className="text-sm">Nothing is queued for production yet.</p>
        </div>
      );
    }

    if (data.counts.blocked === 0) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
          <p className="text-lg font-medium text-foreground">
            All {data.orders.length} order{data.orders.length === 1 ? '' : 's'} clear to proceed
          </p>
          <p className="text-sm">No blockers across {data.orders.length} checked.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Style</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Blocked by</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.orders.map((order) => {
              // The first blocker with a destination decides the Fix button. Ordering follows the
              // validator order, so the earliest unmet prerequisite wins.
              const fix = order.blockers.map((b) => resolveBlockerRoute(b, order)).find((r) => r != null) ?? null;

              return (
                <TableRow key={order.orderItemId}>
                  <TableCell>
                    <button
                      className="font-medium hover:underline text-left"
                      onClick={() => navigate(`/orders/${order.orderId}`)}
                    >
                      {order.orderNumber}
                    </button>
                    {order.customerName && <div className="text-xs text-muted-foreground">{order.customerName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.styleCode}</div>
                    {order.styleName && <div className="text-xs text-muted-foreground">{order.styleName}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{order.quantity.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <DeliveryCell order={order} />
                  </TableCell>
                  <TableCell>
                    {order.workOrderCount > 0 ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Cutting under way
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {order.blockers.slice(0, 3).map((b, i) => (
                          <BlockerChip key={`${b.type}-${i}`} blocker={b} />
                        ))}
                        {order.blockers.length > 3 && (
                          <span className="text-xs text-muted-foreground self-center">
                            +{order.blockers.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {fix && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(fix.to)}>
                        {fix.label}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  // One line saying what the table means, so the insight does not have to be read off 8 rows.
  const lede = (() => {
    if (!data || data.orders.length === 0 || data.counts.blocked === 0) return null;
    const counts = new Map<string, number>();
    for (const o of data.orders) {
      for (const b of new Set(o.blockers.map((x) => x.type))) counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return `${data.counts.blocked} of ${data.orders.length} orders can't start cutting — ${top[1]} ${
      top[1] === 1 ? 'is' : 'are'
    } waiting on ${top[0].replace(/_/g, ' ').toLowerCase()}.`;
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Production Pipeline
            </CardTitle>
            <CardDescription>{lede ?? 'Open orders and what stands between them and the floor'}</CardDescription>
          </div>
          {data && data.orders.length > 0 && (
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                Running {data.counts.running}
              </Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                Blocked {data.counts.blocked}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">{body()}</CardContent>
      {data?.truncated && (
        <div className="px-6 py-3 border-t text-sm text-muted-foreground">
          Showing {data.orders.length} of {data.counts.total} open orders.
        </div>
      )}
    </Card>
  );
}

export default PipelineSection;
