/**
 * SearchInput reports what the user TYPED — never the text its parent already has.
 *
 * Until 2026-09-27 its debounce effect listed `onChange` as a dependency and called it with no
 * comparison, so every parent render with a new inline onChange re-sent the unchanged text 300 ms
 * later. Pages whose onChange also resets page→1 (Colour Master, Cost Sheets, Customers, Dispatch,
 * Embroidery, Job Work Orders) could not leave page 1, and the PO list — whose onChange writes the
 * URL, which re-renders it — looped ~3×/s, stripping ?page= and undoing tab clicks.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SearchInput from '@/components/SearchInput';

const box = () => screen.getByRole('textbox') as HTMLInputElement;
const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('SearchInput — reports only a typed change', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never calls onChange when the value is unchanged, however often the parent re-renders', () => {
    const calls: string[] = [];
    const { rerender } = render(<SearchInput value="lace" onChange={(v) => calls.push(v)} />);
    wait(1000);
    // A new onChange identity on every render — exactly what an inline arrow does
    for (let i = 0; i < 5; i++) {
      rerender(<SearchInput value="lace" onChange={(v) => calls.push(`render ${i}: ${v}`)} />);
      wait(400);
    }
    expect(calls).toEqual([]);
    expect(box()).toHaveValue('lace');
  });

  it('reports typed text once, after the debounce, and not again when the parent echoes it', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} debounceMs={300} />);

    fireEvent.change(box(), { target: { value: 'V' } });
    fireEvent.change(box(), { target: { value: 'VS' } });
    fireEvent.change(box(), { target: { value: 'VSM' } });
    wait(299);
    expect(onChange).not.toHaveBeenCalled();
    wait(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('VSM');

    // The parent stores it and re-renders with a fresh handler
    const next = vi.fn();
    rerender(<SearchInput value="VSM" onChange={next} debounceMs={300} />);
    wait(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it('takes an outside change into the box without reporting it back', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="old" onChange={onChange} />);

    rerender(<SearchInput value="" onChange={vi.fn()} />); // a page's Clear filters
    expect(box()).toHaveValue('');
    rerender(<SearchInput value="PO2609" onChange={onChange} />); // back/forward restores the URL
    expect(box()).toHaveValue('PO2609');
    wait(1000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps what the user typed while the parent answers late with the earlier text', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="" onChange={onChange} />);

    fireEvent.change(box(), { target: { value: 'ab' } });
    wait(300);
    expect(onChange).toHaveBeenLastCalledWith('ab');

    // The user types on before the parent's (transition) render lands with 'ab'
    fireEvent.change(box(), { target: { value: 'abc' } });
    rerender(<SearchInput value="ab" onChange={onChange} />);
    expect(box()).toHaveValue('abc');
    wait(300);
    expect(onChange).toHaveBeenLastCalledWith('abc');
    expect(onChange).toHaveBeenCalledTimes(2);

    // Once echoed, a later outside change to the same text still reaches the box
    rerender(<SearchInput value="abc" onChange={onChange} />);
    rerender(<SearchInput value="" onChange={onChange} />);
    expect(box()).toHaveValue('');
    rerender(<SearchInput value="abc" onChange={onChange} />);
    expect(box()).toHaveValue('abc');
    wait(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('clears at once, and does not report a clear the parent already has', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="lace" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('');

    rerender(<SearchInput value="" onChange={onChange} />);
    fireEvent.change(box(), { target: { value: 'x' } }); // typed, not yet reported
    fireEvent.click(screen.getByRole('button'));
    wait(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('passes input attributes such as maxLength through to the input', () => {
    render(<SearchInput value="" onChange={vi.fn()} maxLength={100} aria-label="Search purchase orders" />);
    expect(box()).toHaveAttribute('maxLength', '100');
    expect(screen.getByLabelText('Search purchase orders')).toBe(box());
  });

  it('lets a list that resets page→1 in onChange leave page 1 (JobWorkOrderList wiring)', () => {
    function Page() {
      const [search, setSearch] = useState('');
      const [page, setPage] = useState(1);
      return (
        <>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <button type="button" onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
          <span data-testid="page">{page}</span>
        </>
      );
    }
    render(<Page />);
    wait(500);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    wait(1000);
    expect(screen.getByTestId('page')).toHaveTextContent('2');

    // A real search still sends the user back to page 1
    fireEvent.change(box(), { target: { value: 'DJ' } });
    wait(300);
    expect(screen.getByTestId('page')).toHaveTextContent('1');
  });
});

describe('SearchInput — onClear', () => {
  it('the ✕ reports an empty search and then calls onClear once; typing the box empty does not', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(<SearchInput value="" onChange={onChange} onClear={onClear} />);
    fireEvent.change(box(), { target: { value: 'kasya' } });
    wait(350);
    expect(onChange).toHaveBeenLastCalledWith('kasya');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(onClear).toHaveBeenCalledTimes(1);

    fireEvent.change(box(), { target: { value: 'k' } });
    wait(350);
    fireEvent.change(box(), { target: { value: '' } });
    wait(350);
    expect(onClear).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
