import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { fabricService } from '@/services/fabricGreigeService';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { FabricMaster } from '@/types/fabric-greige.types';
import { toast } from 'sonner';

/**
 * The fabric LIST caps a page at 100 (`fabricQuerySchema` in fabricGreige.schema.ts), below the pickers'
 * usual PICKER_LIMIT of 200 — asking for 200 makes every load a 400 and the picker sits on
 * "Could not load — open to retry".
 */
const FABRIC_PAGE = 100;

interface FabricComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  /** The picked fabric itself (null when cleared) — for forms that copy its width, GSM or greige. */
  onFabricChange?: (fabric: FabricMaster | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Only the fabrics made from this greige — for a greige → fabric cascade. */
  greigeId?: string;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All fabrics")
}

/** The greige a fabric is made from, as the Fabric Master list names it. */
const greigeNameOf = (fabric: FabricMaster) => fabric.greige?.greigeName || fabric.greigeName || '';

/** Each style the fabric is allocated to once: its code and the buyer's code for it. */
function styleCodes(fabric: FabricMaster): string[] {
  const codes = new Set<string>();
  for (const allocation of fabric.fabrics ?? []) {
    const style = allocation.components?.style;
    if (style?.styleCode) codes.add(style.styleCode);
    if (style?.buyerStyleRef) codes.add(style.buyerStyleRef);
  }
  return [...codes];
}

function fabricOption(fabric: FabricMaster): ComboboxOption {
  const colour = fabric.colorName
    ? fabric.colorCode
      ? `${fabric.colorName} (${fabric.colorCode})`
      : fabric.colorName
    : fabric.colorCode || '';
  const greige = greigeNameOf(fabric);
  const description = [colour, greige].filter(Boolean).join(' · ');
  return {
    value: fabric.id,
    label: fabric.fabricName ? `${fabric.fabricCode} — ${fabric.fabricName}` : fabric.fabricCode,
    description: description || undefined,
    searchText: `${fabric.fabricCode} ${fabric.fabricName ?? ''} ${fabric.colorName ?? ''} ${fabric.colorCode ?? ''} ${greige} ${styleCodes(fabric).join(' ')}`,
  };
}

/**
 * Picks a FABRIC MASTER (a finished fabric — not a stock lot, not a greige). Server-searched through the
 * Fabric Master list, whose search matches the fabric code, name, colour name / code, greige name and the
 * styles it is allocated to, so typing any of those narrows it. Active fabrics only (the list's default);
 * a chosen inactive fabric is still named, through the one-off lookup below.
 *
 * A new greige is a new list, so the picker remounts per greige (as OrderCombobox does per customer) and
 * never offers the previous greige's fabrics while the new list loads.
 */
export function FabricCombobox(props: FabricComboboxProps) {
  return <FabricPicker key={props.greigeId ?? ''} {...props} />;
}

function FabricPicker({
  value,
  onValueChange,
  onFabricChange,
  placeholder = 'Select fabric...',
  className,
  disabled = false,
  greigeId,
  allowAll = false,
  allLabel = 'All fabrics',
}: FabricComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<FabricMaster>> => {
      const response = await fabricService.getAll({
        page: 1,
        limit: FABRIC_PAGE,
        search: search || undefined,
        greigeId: greigeId || undefined,
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [greigeId]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<FabricMaster>({
    fetch,
    toOption: fabricOption,
    // The picker's own limit, so a full page without a total still reads as "more may exist"
    limit: FABRIC_PAGE,
    narrowHint: 'type a fabric code, name, colour, greige or style to narrow',
    onError: (error) => {
      console.error('Failed to load fabrics:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load fabrics');
    },
  });

  // A chosen fabric outside the first page (an edit form, a filter restored from the URL, an inactive
  // fabric) is fetched once so the box can name it; after that the combobox remembers its label through
  // later searches.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    // Not cancelled on cleanup: the once-only guard above would then never retry it. A late answer only
    // puts one more fabric in the list.
    fabricService
      .getById(value)
      .then((fabric) => {
        if (fabric) addItem(fabric);
      })
      .catch((error) => console.error('Failed to fetch the selected fabric:', error));
  }, [value, initialLoaded, byId, addItem]);

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: 'all fabrics' }, ...options] : options}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        onFabricChange?.(next ? (byId.get(next) ?? null) : null);
      }}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading fabrics...') : placeholder}
      searchPlaceholder="Search by fabric code, name, colour, greige, style..."
      emptyText={greigeId ? 'No fabrics found for this greige.' : 'No fabrics found.'}
      disabled={disabled}
      className={className}
      onOpenChange={(open) => {
        if (open && !initialLoaded && !isLoading) load('');
      }}
      onSearchChange={load}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
