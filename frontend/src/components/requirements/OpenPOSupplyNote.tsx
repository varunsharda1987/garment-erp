/**
 * "An open PO covers this, not linked" (docs/plans/po-allocation-design.md §7) — shown to everyone under a
 * requirement's status; the Link beside Use Stock only to whoever may link (MRP or Purchase Orders permission).
 * Link opens the PO page's Allocate dialog on that PO with only these requirements ticked; nothing is linked
 * until it is saved. Wording and targets live in ./open-po-supply.
 */
import { ChevronDown, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatQuantity } from '@/lib/formatters';
import type { MaterialRequirement, OpenPOSupplyLine } from '@/types/mrp.types';
import { linkedPOTexts, openPOSupplyWords, poLinkTargets, type POLinkTarget } from './open-po-supply';

/** The amber note: "PO2609-0231 · 1,589 pcs free · not linked (unlinked orders need 2,941 pcs)" */
export function OpenPOSupplyNote({
  supply,
  unit,
  className,
  headlineOnly = false,
}: {
  supply: readonly OpenPOSupplyLine[] | null | undefined;
  unit: string;
  className?: string;
  /** Just the first line (a group header); the rest stays in the hover text */
  headlineOnly?: boolean;
}) {
  const words = openPOSupplyWords(supply, unit);
  if (!words) return null;
  return (
    <div className={`text-xs leading-snug ${className ?? ''}`} title={words.title} data-testid="open-po-supply-note">
      <div className="text-amber-700">{words.headline}</div>
      {!headlineOnly && (
        <>
          {words.details.map((d) => (
            <div key={d} className="text-muted-foreground">
              {d}
            </div>
          ))}
          {words.blockedReason && <div className="text-muted-foreground italic">{words.blockedReason}</div>}
        </>
      )}
    </div>
  );
}

/**
 * Link to an open PO: one button when one PO can take these requirements, a menu when several can. Nothing when
 * none can.
 */
export function LinkPOButton({
  reqs,
  onLink,
  label = 'Link',
}: {
  reqs: readonly MaterialRequirement[];
  onLink: (target: POLinkTarget) => void;
  label?: string;
}) {
  const targets = poLinkTargets(reqs);
  if (targets.length === 0) return null;
  const freeText = (t: POLinkTarget) => `${t.poNumber} · ${formatQuantity(t.freeToLink, t.unit, 3)} free`;
  if (targets.length === 1) {
    const [target] = targets;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-amber-700 hover:text-amber-800 text-xs"
        title={`Link to ${freeText(target)} — pick the quantities before anything is linked`}
        onClick={(e) => {
          e.stopPropagation();
          onLink(target);
        }}
      >
        <Link2 className="h-3 w-3 mr-1" />
        {label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-amber-700 hover:text-amber-800 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className="h-3 w-3 mr-1" />
          {label}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {targets.map((t) => (
          <DropdownMenuItem key={t.poId} onSelect={() => onLink(t)}>
            {freeText(t)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The POs these requirements are on, with what each covers: "PO2609-0231 · 350 pcs" */
export function LinkedPOList({
  reqs,
  unit,
  className,
}: {
  reqs: readonly MaterialRequirement[];
  unit: string;
  className?: string;
}) {
  const texts = linkedPOTexts(reqs, unit);
  if (texts.length === 0) return null;
  return (
    <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
      {texts.map((t) => (
        <div key={t}>{t}</div>
      ))}
    </div>
  );
}
