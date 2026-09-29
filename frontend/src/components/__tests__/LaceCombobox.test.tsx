/**
 * LaceCombobox is the lace filter on the Lace Lab Dips page (greige laces only) and the Lace Stock page (any
 * lace). It follows the picker contract: `allowAll` puts an "All …" row first whose value '' means "no
 * filter"; the list is server-searched over GET /materials/lace; `kind` maps to the API's `isGreige` filter.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LaceCombobox } from '@/components/LaceCombobox';
import { getAllLace, getLaceById } from '@/services/lace.service';

vi.mock('@/services/lace.service', () => ({ getAllLace: vi.fn(), getLaceById: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const pageOf = <T,>(data: T[]) => ({ data, pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 } });

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

const greige = {
  id: 'lace-g1',
  laceCode: 'LACE-0001',
  laceName: 'Cotton Crochet Lace 2cm Greige',
  isGreige: true,
  isActive: true,
};
const dyed = {
  id: 'lace-f1',
  laceCode: 'LACE-0002',
  laceName: 'Cotton Crochet Lace 2cm Navy',
  color: 'Navy',
  isGreige: false,
  isActive: true,
  sourceGreigeLace: { id: 'lace-g1', laceCode: 'LACE-0001', laceName: 'Cotton Crochet Lace 2cm Greige' },
};

describe('LaceCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('greige kind: asks the API for greige laces only, names the choice, and "All greige laces" clears it', async () => {
    mocked(getAllLace).mockResolvedValue(pageOf([greige]));
    const onValue = vi.fn();
    function Filter() {
      const [laceId, setLaceId] = useState('lace-g1');
      return (
        <LaceCombobox
          kind="greige"
          value={laceId}
          onValueChange={(v) => {
            onValue(v);
            setLaceId(v);
          }}
          allowAll
          placeholder="All greige laces"
          className="w-[220px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('LACE-0001 — Cotton Crochet Lace 2cm Greige'));
    expect(trigger()).toHaveClass('w-[220px]');
    // The lace API refuses a limit over 100
    expect(getAllLace).toHaveBeenCalledWith({ page: 1, limit: 100, search: undefined, isGreige: 'true' });
    expect(getLaceById).not.toHaveBeenCalled(); // on the first page, so no extra fetch

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: 'All greige laces' }));
    expect(onValue).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger()).toHaveTextContent('All greige laces'));
  });

  it('any kind: lists every lace, says which is greige and what a dyed lace came from', async () => {
    mocked(getAllLace).mockResolvedValue(pageOf([greige, dyed]));
    const onValue = vi.fn();
    render(<LaceCombobox value="" onValueChange={onValue} allowAll />);
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: 'All laces' })).toBeInTheDocument();
    expect(getAllLace).toHaveBeenCalledWith({ page: 1, limit: 100, search: undefined, isGreige: undefined });
    expect(
      screen.getByRole('option', { name: /LACE-0001 — Cotton Crochet Lace 2cm Greige\s*Greige lace/ })
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('option', { name: /LACE-0002 — Cotton Crochet Lace 2cm Navy\s*Dyed from LACE-0001/ })
    );
    expect(onValue).toHaveBeenLastCalledWith('lace-f1');
  });

  it('finished kind sends isGreige=false, and typing searches the server', async () => {
    mocked(getAllLace).mockResolvedValue(pageOf([dyed]));
    render(<LaceCombobox kind="finished" value="" onValueChange={() => undefined} allowAll />);
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: 'All finished laces' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search by lace code, name, colour, style...'), {
      target: { value: 'navy' },
    });
    await settle();
    expect(getAllLace).toHaveBeenLastCalledWith({ page: 1, limit: 100, search: 'navy', isGreige: 'false' });
  });

  it('names a chosen lace that is not on the first page', async () => {
    mocked(getAllLace).mockResolvedValue(pageOf([]));
    mocked(getLaceById).mockResolvedValue(greige);
    render(<LaceCombobox kind="greige" value="lace-g1" onValueChange={() => undefined} allowAll />);
    await waitFor(() => expect(trigger()).toHaveTextContent('LACE-0001 — Cotton Crochet Lace 2cm Greige'));
    expect(getLaceById).toHaveBeenCalledTimes(1);
    expect(getLaceById).toHaveBeenCalledWith('lace-g1');
  });
});
