/**
 * The shared picker behaviour: alphabetical, honest about what is held back, and immune to
 * responses arriving out of order.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePickerOptions, PICKER_LIMIT } from '@/hooks/usePickerOptions';

type Row = { id: string; code: string };
const rows = (codes: string[]): Row[] => codes.map((code, i) => ({ id: `id-${i}-${code}`, code }));
const toOption = (r: Row) => ({ value: r.id, label: r.code });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('usePickerOptions', () => {
  it('lists what the server returned alphabetically, with no hint when nothing is held back', async () => {
    const fetch = vi.fn().mockResolvedValue({ items: rows(['LNG229', 'COS148', 'DRE215', 'LNG10']), total: 4 });
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption }));

    await waitFor(() => expect(result.current.initialLoaded).toBe(true));
    expect(fetch).toHaveBeenCalledWith('');
    expect(result.current.options.map((o) => o.label)).toEqual(['COS148', 'DRE215', 'LNG10', 'LNG229']);
    expect(result.current.footer).toBeUndefined();
    expect(result.current.byId.size).toBe(4);
  });

  it('says how many the server held back when it reports a total', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ items: rows(Array.from({ length: 200 }, (_, i) => `S${i}`)), total: 1116 });
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption, narrowHint: 'type a code to narrow' }));

    await waitFor(() => expect(result.current.initialLoaded).toBe(true));
    expect(result.current.footer).toBe('Showing 200 of 1,116 — type a code to narrow');
  });

  it('assumes more exist when a plain-array endpoint fills the whole page', async () => {
    const fetch = vi.fn().mockResolvedValue({ items: rows(Array.from({ length: 100 }, (_, i) => `A${i}`)) });
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption, limit: 100 }));

    await waitFor(() => expect(result.current.initialLoaded).toBe(true));
    expect(result.current.footer).toBe('Showing the first 100 — type to narrow');

    // a partial page from a plain array means the list is complete
    fetch.mockResolvedValue({ items: rows(['A1', 'A2']) });
    await act(() => result.current.load('A'));
    expect(result.current.footer).toBeUndefined();
  });

  it('defaults to asking for the full picker page', () => {
    expect(PICKER_LIMIT).toBe(200);
  });

  it('ignores a slow response that arrives after a newer search', async () => {
    const first = deferred<{ items: Row[] }>();
    const second = deferred<{ items: Row[] }>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(Promise.resolve({ items: [] }))
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption }));
    await waitFor(() => expect(result.current.initialLoaded).toBe(true));

    act(() => {
      void result.current.load('L');
      void result.current.load('LN');
    });
    await act(async () => {
      second.resolve({ items: rows(['LNG229']) });
      await Promise.resolve();
    });
    await act(async () => {
      first.resolve({ items: rows(['LACE1', 'LABEL2']) });
      await Promise.resolve();
    });

    expect(result.current.options.map((o) => o.label)).toEqual(['LNG229']);
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps a preselected record the page did not include', async () => {
    const fetch = vi.fn().mockResolvedValue({ items: rows(['B', 'C']), total: 2 });
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption }));
    await waitFor(() => expect(result.current.initialLoaded).toBe(true));

    act(() => result.current.addItem({ id: 'pre', code: 'A' }));
    expect(result.current.options.map((o) => o.label)).toEqual(['A', 'B', 'C']);
    act(() => result.current.addItem({ id: 'pre', code: 'A' }));
    expect(result.current.options).toHaveLength(3);
  });

  it('reports a failed load and keeps the previous list', async () => {
    const onError = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ items: rows(['A']), total: 1 })
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePickerOptions({ fetch, toOption, onError }));
    await waitFor(() => expect(result.current.initialLoaded).toBe(true));

    await act(() => result.current.load('zzz'));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(result.current.options.map((o) => o.label)).toEqual(['A']);
    expect(result.current.isLoading).toBe(false);
  });
});
