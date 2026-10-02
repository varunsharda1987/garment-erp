/**
 * One behaviour for every server-searched picker (Style, Customer, Supplier, Material, Colour…).
 *
 * Why (2026-09-14): each picker asked its endpoint for the first 50 rows — newest first — and
 * showed them as if that were everything. With 1,116 styles, 352 materials and 194 colours the
 * older ones were simply absent, with nothing on screen saying so. This hook:
 *   - asks for a full picker page (PICKER_LIMIT, or the endpoint's own cap),
 *   - lists what came back alphabetically (a picker is scanned by eye, not by recency),
 *   - says "Showing N of M — type to narrow" whenever the server held some back,
 *   - drops responses that arrive out of order while the user is still typing,
 *   - never leaves a picker dead: a failed first load is reported (`loadError`) and the wrapper retries
 *     it when the picker is next opened — one blip (an API mid-restart) used to disable the trigger
 *     until a page reload (2026-09-19, the receive dialog's warehouse box).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ComboboxOption } from '@/components/ui/combobox';

/** What a picker asks for when the endpoint allows it (the API's own maximum page). */
export const PICKER_LIMIT = 200;

export interface PickerPage<T> {
  items: T[];
  /** Reported by paginated endpoints; leave undefined for endpoints that return a plain array. */
  total?: number;
}

interface UsePickerOptionsArgs<T> {
  /** Load one page for the typed search. Memoise it (useCallback) on the picker's own filters. */
  fetch: (search: string) => Promise<PickerPage<T>>;
  toOption: (item: T) => ComboboxOption;
  /** What `fetch` asks the server for — when `total` is unknown, a full page means "more may exist". */
  limit?: number;
  /** Sort the received options by label (default true). Off when the server order carries meaning. */
  sortAlphabetically?: boolean;
  /** Tail of the hint, e.g. "type part of the style code to narrow". */
  narrowHint?: string;
  onError?: (error: unknown) => void;
}

/**
 * The server search's rule, for pickers whose endpoint returns the whole list and so search on the client:
 * every typed word must appear in `text` (any case, any order).
 */
export function matchesSearch(text: string, search: string): boolean {
  const haystack = text.toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const byLabel = (a: ComboboxOption, b: ComboboxOption) =>
  a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });

export function usePickerOptions<T extends { id: string }>({
  fetch,
  toOption,
  limit = PICKER_LIMIT,
  sortAlphabetically = true,
  narrowHint = 'type to narrow',
  onError,
}: UsePickerOptionsArgs<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Fast typing fires several fetches; only the latest may update the list.
  const requestSeq = useRef(0);
  // The search the list answers, so a filter change reloads for the typed text rather than for ''
  const lastSearch = useRef('');
  // Read only in the async load's error path, never while rendering: refreshed after each render.
  const onErrorRef = useRef(onError);
  useLayoutEffect(() => {
    onErrorRef.current = onError;
  });

  const load = useCallback(
    async (search: string) => {
      lastSearch.current = search;
      const seq = ++requestSeq.current;
      setIsLoading(true);
      try {
        const page = await fetch(search);
        if (seq !== requestSeq.current) return;
        setItems(page.items);
        setTotal(page.total);
        setInitialLoaded(true);
        setLoadError(false);
      } catch (error) {
        if (seq === requestSeq.current) {
          setLoadError(true);
          onErrorRef.current?.(error);
        }
      } finally {
        if (seq === requestSeq.current) setIsLoading(false);
      }
    },
    [fetch]
  );

  // Initial load, and a reload whenever the picker's filters (baked into `fetch`) change — the ONLY
  // unprompted load: the combobox sends typed changes alone (2026-09-27, it used to repeat '' after
  // mount and re-send its text on every new `load`, so each mount and filter change fetched twice).
  useEffect(() => {
    load(lastSearch.current);
  }, [load]);

  /** Put a record the list does not hold (a preselected value) in front of it. */
  const addItem = useCallback((item: T) => {
    setItems((prev) => (prev.some((p) => p.id === item.id) ? prev : [item, ...prev]));
  }, []);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  // Callers pass `toOption` inline (a new function every render) and it only maps a record to its
  // label, so the list is re-mapped when the records change, not on every render.
  const options = useMemo(() => {
    const opts = items.map((item) => toOption(item));
    return sortAlphabetically ? [...opts].sort(byLabel) : opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toOption is a fresh inline function each render
  }, [items, sortAlphabetically]);

  const shown = items.length;
  const heldBack = total !== undefined ? total > shown : shown >= limit;
  const footer = !heldBack
    ? undefined
    : total !== undefined
      ? `Showing ${shown.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} — ${narrowHint}`
      : `Showing the first ${shown.toLocaleString('en-IN')} — ${narrowHint}`;

  return { options, items, byId, addItem, isLoading, initialLoaded, loadError, load, total, footer };
}
