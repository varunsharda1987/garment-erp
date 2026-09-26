/**
 * The server-searched Combobox (every picker built on usePickerOptions) must:
 *   - keep naming the selected value when a typed search narrows the list away from it. Before
 *     2026-09-27: pick supplier "Hardik", reopen, type "VSM", Escape → the PO list's trigger read
 *     "All Suppliers" while the list was still filtered to Hardik;
 *   - forget the typed search when it closes;
 *   - send only typed changes — its '' after mount doubled every picker's first fetch
 *     (GET /api/suppliers?limit=200 twice per mount).
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { getAllSuppliers } from '@/services/supplier.service';

vi.mock('@/services/supplier.service', () => ({ getAllSuppliers: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const SUPPLIERS: ComboboxOption[] = [
  { value: 'sup-h', label: 'SUP-001 - Hardik Textiles' },
  { value: 'sup-v', label: 'SUP-002 - VSM Weaves' },
  { value: 'sup-k', label: 'SUP-003 - Kiran Dyers' },
];

/** Longer than the 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));
const trigger = () => screen.getAllByRole('combobox').find((el) => el.tagName === 'BUTTON')!;
const searchBox = () => screen.getByPlaceholderText('Search...') as HTMLInputElement;

/** A page's supplier filter over a server search: `options` holds only what the last search returned. */
function ServerSearchedPicker({ onSearch }: { onSearch: (search: string) => void }) {
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const narrowed = SUPPLIERS.filter((s) => s.label.toLowerCase().includes(search.toLowerCase()));
  return (
    <Combobox
      options={[{ value: '', label: 'All Suppliers' }, ...narrowed]}
      value={value}
      onValueChange={setValue}
      placeholder="All Suppliers"
      // Inline on purpose: a new identity every render must not re-send the search
      onSearchChange={(s) => {
        onSearch(s);
        setSearch(s);
      }}
    />
  );
}

describe('Combobox — server search', () => {
  it('sends nothing on mount and each typed change once', async () => {
    const onSearch = vi.fn();
    render(<ServerSearchedPicker onSearch={onSearch} />);
    await settle();
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.click(trigger());
    fireEvent.change(searchBox(), { target: { value: 'V' } });
    fireEvent.change(searchBox(), { target: { value: 'VS' } });
    await settle();
    await settle(); // the re-render its own send caused must not send it again
    expect(onSearch.mock.calls).toEqual([['VS']]);
  });

  it('keeps naming the selected value after a search narrows the list away from it, and resets the search on close', async () => {
    const onSearch = vi.fn();
    render(<ServerSearchedPicker onSearch={onSearch} />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: /Hardik/ }));
    expect(trigger()).toHaveTextContent('SUP-001 - Hardik Textiles');

    fireEvent.click(trigger());
    fireEvent.change(searchBox(), { target: { value: 'VSM' } });
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith('VSM'));
    expect(screen.queryByRole('option', { name: /Hardik/ })).not.toBeInTheDocument();

    fireEvent.keyDown(searchBox(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument());
    expect(trigger()).toHaveTextContent('SUP-001 - Hardik Textiles');
    expect(trigger()).not.toHaveTextContent('All Suppliers');

    // The typed search is dropped with the list, and the owner is told so it reloads everything
    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith(''));
    fireEvent.click(trigger());
    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('option', { name: /Hardik/ })).toBeInTheDocument();
  });

  it('falls back to the placeholder once the value is cleared', async () => {
    render(<ServerSearchedPicker onSearch={vi.fn()} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: /Kiran/ }));
    expect(trigger()).toHaveTextContent('SUP-003 - Kiran Dyers');

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: /Kiran/ })); // picking it again clears it
    expect(trigger()).toHaveTextContent('All Suppliers');
  });
});

describe('SupplierCombobox — one fetch per need', () => {
  const fetchSuppliers = getAllSuppliers as unknown as ReturnType<typeof vi.fn>;
  const rows = [
    { id: 'sup-h', code: 'SUP-001', name: 'Hardik Textiles' },
    { id: 'sup-v', code: 'SUP-002', name: 'VSM Weaves' },
  ];

  beforeEach(() => {
    fetchSuppliers.mockReset();
    fetchSuppliers.mockImplementation(async ({ search }: { search?: string }) => {
      const data = search ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rows;
      return { data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } };
    });
  });

  function Filter() {
    const [supplierId, setSupplierId] = useState('');
    return <SupplierCombobox value={supplierId} onValueChange={setSupplierId} allowAll placeholder="All Suppliers" />;
  }

  it('loads the list once on mount, then once per typed search and once on the reset', async () => {
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('All Suppliers'));
    await settle();
    expect(fetchSuppliers).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: /Hardik/ }));
    fireEvent.click(trigger());
    fireEvent.change(screen.getByPlaceholderText('Search by code, name, contact...'), { target: { value: 'VSM' } });
    await waitFor(() => expect(fetchSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'VSM' })));
    await waitFor(() => expect(screen.queryByRole('option', { name: /Hardik/ })).not.toBeInTheDocument());

    fireEvent.keyDown(screen.getByPlaceholderText('Search by code, name, contact...'), { key: 'Escape' });
    expect(trigger()).toHaveTextContent('SUP-001 - Hardik Textiles');
    await waitFor(() => expect(fetchSuppliers).toHaveBeenCalledTimes(3));
    expect(fetchSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined }));
    await settle();
    expect(fetchSuppliers).toHaveBeenCalledTimes(3);
    expect(trigger()).toHaveTextContent('SUP-001 - Hardik Textiles');
  });
});
