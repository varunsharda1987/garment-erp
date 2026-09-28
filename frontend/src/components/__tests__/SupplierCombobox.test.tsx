/**
 * The PO form's supplier picker (2026-09-28):
 *   - a new category never offers the previous category's suppliers while its own list loads — a greige
 *     supplier was picked on a Greige Lace PO in that window;
 *   - the PO's own supplier stays named when the category filter leaves it out — a Trims PO MRP raised with
 *     a packaging supplier opened with a blank supplier box.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { getAllSuppliers } from '@/services/supplier.service';

vi.mock('@/services/supplier.service', () => ({ getAllSuppliers: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const fetchSuppliers = getAllSuppliers as unknown as ReturnType<typeof vi.fn>;
const page = (data: Array<{ id: string; code: string; name: string }>) => ({
  data,
  pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 },
});
/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

describe('SupplierCombobox', () => {
  beforeEach(() => {
    fetchSuppliers.mockReset();
  });

  it("never shows the previous category's suppliers while the new list loads", async () => {
    let resolveLace: (value: unknown) => void = () => undefined;
    fetchSuppliers.mockImplementation(({ category }: { category?: string }) =>
      category === 'LACE_SUPPLIER'
        ? new Promise((resolve) => {
            resolveLace = resolve;
          })
        : Promise.resolve(page([{ id: 'sup-g', code: 'SUP-001', name: 'Greige Mill' }]))
    );

    const { rerender } = render(
      <SupplierCombobox value="" onValueChange={() => undefined} categoryFilter="GREIGE_SUPPLIER" />
    );
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /Greige Mill/ })).toBeInTheDocument();

    rerender(<SupplierCombobox value="" onValueChange={() => undefined} categoryFilter="LACE_SUPPLIER" />);
    expect(trigger()).toHaveTextContent('Loading suppliers...');
    fireEvent.click(trigger());
    expect(screen.queryByRole('option', { name: /Greige Mill/ })).not.toBeInTheDocument();

    await act(async () => resolveLace(page([{ id: 'sup-l', code: 'SUP-002', name: 'Lace House' }])));
    expect(await screen.findByRole('option', { name: /Lace House/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Greige Mill/ })).not.toBeInTheDocument();
  });

  it("names the PO's own supplier even when the category filter leaves it out", async () => {
    fetchSuppliers.mockImplementation(async ({ search }: { search?: string }) => {
      const rows = [{ id: 'sup-h', code: 'SUP-001', name: 'Hardik Trims' }];
      return page(search ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())) : rows);
    });

    render(
      <SupplierCombobox
        value="sup-s"
        onValueChange={() => undefined}
        categoryFilter="TRIMS_SUPPLIER"
        selectedSupplier={{ id: 'sup-s', code: 'SUP-009', name: 'Sundeep Packaging' }}
      />
    );
    // Named at once — before the list has even loaded
    expect(trigger()).toHaveTextContent('SUP-009 - Sundeep Packaging');
    await waitFor(() => expect(fetchSuppliers).toHaveBeenCalled());

    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /Sundeep Packaging/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Hardik Trims/ })).toBeInTheDocument();

    // A search it does not match hides it from the list; the trigger still names it
    fireEvent.change(screen.getByPlaceholderText('Search by code, name, contact...'), { target: { value: 'Hardik' } });
    await settle();
    expect(screen.queryByRole('option', { name: /Sundeep Packaging/ })).not.toBeInTheDocument();
    expect(trigger()).toHaveTextContent('SUP-009 - Sundeep Packaging');
  });

  it('shows nothing extra when the selected record is not the value', async () => {
    fetchSuppliers.mockResolvedValue(page([{ id: 'sup-h', code: 'SUP-001', name: 'Hardik Trims' }]));

    render(
      <SupplierCombobox
        value=""
        onValueChange={() => undefined}
        categoryFilter="TRIMS_SUPPLIER"
        selectedSupplier={{ id: 'sup-s', code: 'SUP-009', name: 'Sundeep Packaging' }}
      />
    );
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: /Hardik Trims/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Sundeep Packaging/ })).not.toBeInTheDocument();
  });
});
