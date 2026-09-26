/**
 * The hook's own load is the only unprompted one: once on mount, and once when the picker's filters
 * (baked into `fetch`) change — for the search the user typed, since the combobox no longer re-sends
 * its text when `load` changes (2026-09-27: each mount and filter change fetched twice).
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';

type Row = { id: string; code: string };
const toOption = (r: Row) => ({ value: r.id, label: r.code });
const page = (codes: string[]): PickerPage<Row> => ({ items: codes.map((code) => ({ id: code, code })) });

describe('usePickerOptions — reloads', () => {
  it('loads once on mount, with no search', async () => {
    const fetch = vi.fn().mockResolvedValue(page(['A']));
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption }));
    await waitFor(() => expect(result.current.initialLoaded).toBe(true));
    expect(fetch.mock.calls).toEqual([['']]);
  });

  it('reloads once for the typed search when the filters change', async () => {
    const dyers = vi.fn().mockResolvedValue(page(['VSM-DYE']));
    const weavers = vi.fn().mockResolvedValue(page(['VSM-WEAVE']));
    const { result, rerender } = renderHook(({ fetch }) => usePickerOptions({ fetch, toOption }), {
      initialProps: { fetch: dyers },
    });
    await waitFor(() => expect(result.current.initialLoaded).toBe(true));
    await act(() => result.current.load('VSM'));

    rerender({ fetch: weavers });
    await waitFor(() => expect(result.current.options.map((o) => o.label)).toEqual(['VSM-WEAVE']));
    expect(weavers.mock.calls).toEqual([['VSM']]);

    // Cleared search, then a filter change: the unfiltered list
    await act(() => result.current.load(''));
    const all = vi.fn().mockResolvedValue(page(['A', 'B']));
    rerender({ fetch: all });
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(all.mock.calls).toEqual([['']]);
  });
});
