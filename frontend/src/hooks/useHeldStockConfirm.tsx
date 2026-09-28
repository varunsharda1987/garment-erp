/**
 * Ask before taking goods held for another order (owner decision D10), then send again with `takeHeld: true`.
 *
 *   const { withHeldStockConfirm, heldStockDialog } = useHeldStockConfirm();
 *   const result = await withHeldStockConfirm((takeHeld) => issueChallan({ ...body, takeHeld }), 'PIECE');
 *   if (result === undefined) return; // the user kept them for the other order
 *   …
 *   return <>{…}{heldStockDialog}</>;
 *
 * Any other error is thrown as it came, so the screen's own error handling still runs.
 * The wording and the refusal's shape live in lib/held-stock-confirm.ts.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { extractHeldStock, heldForLine, heldStockQuestion, type HeldStockRefusal } from '@/lib/held-stock-confirm';

export interface UseHeldStockConfirm {
  /**
   * Run `send(false)`; if the server says the goods are held for another order, ask, and on yes run
   * `send(true)`. Resolves to what `send` returned, or undefined when the user said no.
   */
  withHeldStockConfirm: <T>(send: (takeHeld: boolean) => Promise<T>, unit?: string | null) => Promise<T | undefined>;
  /** Render this once in the screen */
  heldStockDialog: ReactNode;
}

export function useHeldStockConfirm(): UseHeldStockConfirm {
  const [asking, setAsking] = useState<{ refusal: HeldStockRefusal; unit: string | null } | null>(null);
  const answer = useRef<((take: boolean) => void) | null>(null);

  const settle = useCallback((take: boolean) => {
    const resolve = answer.current;
    answer.current = null;
    setAsking(null);
    resolve?.(take);
  }, []);

  // A screen that goes away mid-question must not leave its save waiting forever
  useEffect(() => {
    const pending = answer;
    return () => pending.current?.(false);
  }, []);

  const withHeldStockConfirm = useCallback(
    async <T,>(send: (takeHeld: boolean) => Promise<T>, unit?: string | null): Promise<T | undefined> => {
      try {
        return await send(false);
      } catch (err) {
        const refusal = extractHeldStock(err);
        if (!refusal) throw err;
        const take = await new Promise<boolean>((resolve) => {
          answer.current?.(false);
          answer.current = resolve;
          setAsking({ refusal, unit: unit ?? null });
        });
        if (!take) return undefined;
        return send(true);
      }
    },
    []
  );

  const heldStockDialog = (
    <AlertDialog
      open={asking !== null}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>These goods are held for another order</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {asking && asking.refusal.heldFor.length > 0 ? (
                <ul className="space-y-1 text-foreground">
                  {asking.refusal.heldFor.map((h, i) => (
                    <li key={`${h.orderNumber ?? h.requirementNumber ?? 'held'}-${i}`}>
                      {heldForLine(h, asking.unit)}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-foreground">{asking?.refusal.message}</p>
              )}
              {asking && <p>{heldStockQuestion(asking.refusal)}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, keep them</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: 'destructive' })}
            onClick={(e) => {
              e.preventDefault();
              settle(true);
            }}
          >
            Take them anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { withHeldStockConfirm, heldStockDialog };
}
