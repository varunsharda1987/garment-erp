/**
 * ProcessorCombobox has two sources. Without `categories` it lists the dye / print / wash / finish roster
 * (GET /mrp/processing-assignment/processors) exactly as before. With `categories` — the Job Work Orders
 * filter passes every job-work category — it lists the suppliers holding any of them
 * (GET /suppliers?category=A,B), searched on the server, and still names a chosen processor that is not in
 * the first page (e.g. one deactivated since its jobs were raised).
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProcessorCombobox } from '@/components/ProcessorCombobox';
import { getAllSuppliers, getSupplierById } from '@/services/supplier.service';
import { getProcessorSuppliers } from '@/services/vendorSuggestion.service';
import type { SupplierCategory } from '@/types/supplier.types';

vi.mock('@/services/supplier.service', () => ({ getAllSuppliers: vi.fn(), getSupplierById: vi.fn() }));
vi.mock('@/services/vendorSuggestion.service', () => ({ getProcessorSuppliers: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const pageOf = <T,>(data: T[]) => ({ data, pagination: { page: 1, limit: 200, total: data.length, totalPages: 1 } });

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

const JOB_WORK: SupplierCategory[] = ['DYEING_PRINTING', 'EMBROIDERY', 'SMOCKING', 'CMT_UNIT', 'OTHER_SERVICES'];

const embroiderer = {
  id: 's-1',
  code: 'SUP-020',
  name: 'Zari Embroidery Works',
  supplierCategories: ['EMBROIDERY'],
  isActive: true,
};
const smocker = { id: 's-2', code: 'SUP-021', name: 'Neha Smocking', supplierCategories: ['SMOCKING'], isActive: true };

describe('ProcessorCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('without categories lists the processing roster, as before', async () => {
    mocked(getProcessorSuppliers).mockResolvedValue({
      processorList: [
        { id: 'p-1', code: 'SUP-010', name: 'Kiran Dyers', supplierCategories: ['DYEING_PRINTING'], isActive: true },
      ],
      count: 1,
    });
    render(<ProcessorCombobox value="p-1" onValueChange={() => undefined} allowAll />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SUP-010 - Kiran Dyers'));
    expect(getProcessorSuppliers).toHaveBeenCalledTimes(1);
    expect(getAllSuppliers).not.toHaveBeenCalled();
  });

  it('with categories lists those suppliers, searches on the server, and "All processors" hands back ""', async () => {
    mocked(getAllSuppliers).mockResolvedValue(pageOf([embroiderer, smocker]));
    const onValue = vi.fn();
    function Filter() {
      const [processorId, setProcessorId] = useState('s-2');
      return (
        <ProcessorCombobox
          value={processorId}
          onValueChange={(v) => {
            onValue(v);
            setProcessorId(v);
          }}
          categories={JOB_WORK}
          allowAll
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SUP-021 - Neha Smocking'));
    expect(getAllSuppliers).toHaveBeenCalledWith({
      limit: 200,
      search: undefined,
      category: 'DYEING_PRINTING,EMBROIDERY,SMOCKING,CMT_UNIT,OTHER_SERVICES',
    });
    expect(getProcessorSuppliers).not.toHaveBeenCalled();
    expect(getSupplierById).not.toHaveBeenCalled(); // the chosen one was in the list

    fireEvent.click(trigger());
    mocked(getAllSuppliers).mockResolvedValue(pageOf([embroiderer]));
    fireEvent.change(screen.getByPlaceholderText('Search by code, name, contact...'), { target: { value: 'zari' } });
    await settle();
    expect(getAllSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'zari' }));
    expect(screen.getByRole('option', { name: /Zari Embroidery Works/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Neha Smocking/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'All processors' }));
    expect(onValue).toHaveBeenLastCalledWith('');
    await waitFor(() => expect(trigger()).toHaveTextContent('All processors'));
  });

  it('with categories names a chosen processor that is not in the list (fetched once by id)', async () => {
    mocked(getAllSuppliers).mockResolvedValue(pageOf([embroiderer]));
    mocked(getSupplierById).mockResolvedValue({
      id: 's-9',
      code: 'SUP-099',
      name: 'Old Kaaj Button House',
      supplierCategories: ['OTHER_SERVICES'],
      isActive: false,
    });
    render(<ProcessorCombobox value="s-9" onValueChange={() => undefined} categories={JOB_WORK} allowAll />);
    await waitFor(() => expect(trigger()).toHaveTextContent('SUP-099 - Old Kaaj Button House'));
    expect(getSupplierById).toHaveBeenCalledTimes(1);
    expect(getSupplierById).toHaveBeenCalledWith('s-9');
  });
});
