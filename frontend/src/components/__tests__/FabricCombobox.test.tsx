/**
 * FabricCombobox — the shared picker over the fabric MASTER (GET /fabric-management/fabric). The list caps a
 * page at 100 — 200 would 400 — so the picker asks for 100, lists what comes back by label, and follows the
 * shared picker contract: `allowAll` puts an "All …" row whose value is '', a chosen fabric outside the first
 * page is looked up once so its label shows, and a failed first load is retried when the list is opened.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FabricCombobox } from '@/components/FabricCombobox';
import { fabricService } from '@/services/fabricGreigeService';

vi.mock('@/services/fabricGreigeService', () => ({ fabricService: { getAll: vi.fn(), getById: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const pageOf = <T,>(data: T[], total = data.length) => ({
  data,
  pagination: { page: 1, limit: 100, total, totalPages: 1 },
});

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));
const searchBox = () => screen.getByPlaceholderText('Search by fabric code, name, colour, greige, style...');

const rayon = {
  id: 'fab-2',
  fabricCode: 'FAB-0002',
  fabricName: 'Rayon Slub Print',
  colorName: 'Indigo',
  colorCode: 'C-12',
  greige: { id: 'grg-2', greigeName: 'Rayon Slub' },
  fabrics: [{ components: { style: { styleCode: 'LNG001', buyerStyleRef: 'EB-77' } } }],
};
const cotton = {
  id: 'fab-1',
  fabricCode: 'FAB-0001',
  fabricName: 'Cotton Poplin Dyed',
  colorName: null,
  colorCode: null,
  greigeName: 'Cotton Poplin',
  fabrics: [],
};

describe('FabricCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names "<code> — <name>" with colour and greige beneath, sorted by label, and "All" clears', async () => {
    // Newest first from the server; the picker lists by label
    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon, cotton]));
    const onValue = vi.fn();
    function Filter() {
      const [fabricId, setFabricId] = useState('fab-2');
      return (
        <FabricCombobox
          value={fabricId}
          onValueChange={(v) => {
            onValue(v);
            setFabricId(v);
          }}
          allowAll
          greigeId="grg-2"
          className="w-[240px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('FAB-0002 — Rayon Slub Print'));
    expect(trigger()).toHaveClass('w-[240px]');
    expect(fabricService.getAll).toHaveBeenCalledTimes(1);
    expect(fabricService.getAll).toHaveBeenCalledWith({ page: 1, limit: 100, search: undefined, greigeId: 'grg-2' });
    expect(fabricService.getById).not.toHaveBeenCalled(); // on the first page, so no extra fetch

    fireEvent.click(trigger());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'All fabrics',
      'FAB-0001 — Cotton Poplin DyedCotton Poplin',
      'FAB-0002 — Rayon Slub PrintIndigo (C-12) · Rayon Slub',
    ]);

    fireEvent.click(screen.getByRole('option', { name: 'All fabrics' }));
    expect(onValue).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger()).toHaveTextContent('All fabrics'));
  });

  it('sends the typed text to the server and hands a form the picked fabric', async () => {
    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon, cotton]));
    const onValue = vi.fn();
    const onFabric = vi.fn();
    render(<FabricCombobox value="" onValueChange={onValue} onFabricChange={onFabric} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Select fabric...'));
    expect(screen.queryByText('All fabrics')).not.toBeInTheDocument();

    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon]));
    fireEvent.click(trigger());
    fireEvent.change(searchBox(), { target: { value: 'LNG001' } });
    await settle();
    expect(fabricService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'LNG001', limit: 100 }));
    await waitFor(() => expect(screen.queryByRole('option', { name: /FAB-0001/ })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('option', { name: /FAB-0002/ }));
    expect(onValue).toHaveBeenLastCalledWith('fab-2');
    expect(onFabric).toHaveBeenLastCalledWith(rayon);
  });

  it('says so when the server holds some back', async () => {
    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon, cotton], 412));
    render(<FabricCombobox value="" onValueChange={() => undefined} />);
    fireEvent.click(trigger());
    expect(await screen.findByText(/Showing 2 of 412/)).toBeInTheDocument();
  });

  it('names a chosen fabric that is not on the first page (fetched once)', async () => {
    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon]));
    mocked(fabricService.getById).mockResolvedValue({
      id: 'fab-9',
      fabricCode: 'FAB-0009',
      fabricName: 'Georgette Solid',
      fabrics: [],
    });
    render(<FabricCombobox value="fab-9" onValueChange={() => undefined} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('FAB-0009 — Georgette Solid'));
    expect(fabricService.getById).toHaveBeenCalledTimes(1);
    expect(fabricService.getById).toHaveBeenCalledWith('fab-9');
  });

  it('a failed first load says so and retries when the list is opened', async () => {
    mocked(fabricService.getAll).mockRejectedValueOnce(new Error('API restarting'));
    render(<FabricCombobox value="" onValueChange={() => undefined} />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Could not load — open to retry'));

    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon]));
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /FAB-0002/ })).toBeInTheDocument();
    expect(fabricService.getAll).toHaveBeenCalledTimes(2);
  });

  it('a new greige is a new list', async () => {
    mocked(fabricService.getAll).mockResolvedValue(pageOf([rayon]));
    const { rerender } = render(<FabricCombobox value="" onValueChange={() => undefined} greigeId="grg-2" />);
    await waitFor(() => expect(fabricService.getAll).toHaveBeenCalledTimes(1));

    rerender(<FabricCombobox value="" onValueChange={() => undefined} greigeId="grg-1" />);
    await waitFor(() =>
      expect(fabricService.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ greigeId: 'grg-1' }))
    );
    expect(fabricService.getAll).toHaveBeenCalledTimes(2);
  });
});
