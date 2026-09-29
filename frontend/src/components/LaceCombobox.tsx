import { useCallback, useEffect, useRef } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllLace, getLaceById } from '@/services/lace.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { Lace } from '@/types/lace.types';
import { toast } from 'sonner';

/** Which laces the list offers: greige (raw, sent for dyeing) or finished (dyed / bought ready). */
export type LaceKind = 'greige' | 'finished';

interface LaceComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Only greige laces or only finished laces; leave unset for every lace. */
  kind?: LaceKind;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All laces" / "All greige laces" / "All finished laces")
}

/** The lace list API's page cap (trimMasterQuerySchema: limit ≤ 100) — PICKER_LIMIT (200) would be refused. */
const LACE_PICKER_LIMIT = 100;

const DEFAULT_ALL_LABEL: Record<LaceKind | 'any', string> = {
  any: 'All laces',
  greige: 'All greige laces',
  finished: 'All finished laces',
};

const laceSearchText = (lace: Lace) =>
  [lace.laceCode, lace.laceName, lace.laceType, lace.design, lace.color, lace.sourceGreigeLace?.laceCode]
    .filter(Boolean)
    .join(' ');

function laceOption(lace: Lace, kind?: LaceKind): ComboboxOption {
  // The generated lace name already carries type / design / colour; the second line says where it stands
  // when the list mixes greige and finished laces.
  const description = lace.isGreige
    ? kind
      ? undefined
      : 'Greige lace'
    : lace.sourceGreigeLace?.laceCode
      ? `Dyed from ${lace.sourceGreigeLace.laceCode}`
      : undefined;
  return {
    value: lace.id,
    label: `${lace.laceCode} — ${lace.laceName}`,
    description,
    searchText: laceSearchText(lace),
  };
}

/**
 * Picks a LACE MASTER (the lace itself), not a stock lot. Server-searched over GET /materials/lace, whose
 * search matches the lace code, name, type, colour, its greige source, the styles it is used on and its
 * suppliers — so typing any of those narrows it. `kind` limits the list with the API's `isGreige` filter:
 * lace lab dips are raised on a GREIGE lace, while lace stock can hold any lace.
 *
 * A new kind is a new list, so the picker remounts per kind (as SupplierCombobox does per category) and
 * never offers the previous kind's laces while the new list loads.
 */
export function LaceCombobox(props: LaceComboboxProps) {
  return <LacePicker key={props.kind ?? ''} {...props} />;
}

function LacePicker({
  value,
  onValueChange,
  placeholder = 'Select lace...',
  className,
  disabled = false,
  kind,
  allowAll = false,
  allLabel = DEFAULT_ALL_LABEL[kind ?? 'any'],
}: LaceComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Lace>> => {
      const response = await getAllLace({
        page: 1,
        limit: LACE_PICKER_LIMIT,
        search: search || undefined,
        isGreige: kind === 'greige' ? 'true' : kind === 'finished' ? 'false' : undefined,
      });
      return { items: response.data ?? [], total: response.pagination?.total };
    },
    [kind]
  );

  const { options, byId, addItem, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<Lace>({
    fetch,
    toOption: (lace) => laceOption(lace, kind),
    limit: LACE_PICKER_LIMIT,
    narrowHint: 'type a lace code, name, colour or style to narrow',
    onError: (error) => {
      console.error('Failed to load laces:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load laces');
    },
  });

  // A chosen lace outside the first page (or no longer active) is fetched once so the box can name it;
  // after that the combobox remembers its label through later searches.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!value || !initialLoaded || byId.has(value) || fetchedFor.current === value) return;
    fetchedFor.current = value;
    // Not cancelled on cleanup: the once-only guard above would then never retry it. A late answer only
    // puts one more lace in the list.
    getLaceById(value)
      .then((lace) => {
        if (lace) addItem(lace);
      })
      .catch((error) => console.error('Failed to fetch the selected lace:', error));
  }, [value, initialLoaded, byId, addItem]);

  const noun = kind === 'greige' ? 'greige laces' : kind === 'finished' ? 'finished laces' : 'laces';

  return (
    <Combobox
      options={allowAll ? [{ value: '', label: allLabel, searchText: `all ${noun}` }, ...options] : options}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading laces...') : placeholder}
      searchPlaceholder="Search by lace code, name, colour, style..."
      emptyText={`No ${noun} found.`}
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
