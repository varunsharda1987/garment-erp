/**
 * The style picker must reach every style, not the 50 newest, and must say when it is holding
 * back more than it shows (2026-09-14: 1,116 styles, picker showed 50, no hint — "styles are
 * missing").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StyleCombobox, PICKER_LIMIT } from '@/components/StyleCombobox';
import { styleService } from '@/services/style.service';

vi.mock('@/services/style.service', () => ({
  styleService: {
    searchForPicker: vi.fn(),
    getStyleById: vi.fn(),
  },
}));

const searchForPicker = styleService.searchForPicker as ReturnType<typeof vi.fn>;

function styles(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    styleCode: `LNG${String(i).padStart(3, '0')}`,
    styleName: `Style ${i}`,
    buyerStyleRef: null,
    customerName: 'Kasya',
  }));
}

describe('StyleCombobox', () => {
  beforeEach(() => {
    searchForPicker.mockReset();
  });

  it('asks for the full picker page, alphabetical, published styles only by default', async () => {
    searchForPicker.mockResolvedValue({
      data: styles(3),
      pagination: { page: 1, limit: 200, total: 3, totalPages: 1 },
    });

    render(<StyleCombobox value="" onChange={() => undefined} />);

    await waitFor(() => expect(searchForPicker).toHaveBeenCalled());
    expect(searchForPicker).toHaveBeenCalledWith({ search: undefined, status: 'ACTIVE', limit: PICKER_LIMIT });
    expect(PICKER_LIMIT).toBe(200);
  });

  it('includes drafts only when explicitly asked (status={null})', async () => {
    searchForPicker.mockResolvedValue({ data: [], pagination: { page: 1, limit: 200, total: 0, totalPages: 0 } });

    render(<StyleCombobox value="" onChange={() => undefined} status={null} />);

    await waitFor(() => expect(searchForPicker).toHaveBeenCalled());
    expect(searchForPicker.mock.calls[0][0].status).toBeUndefined();
  });

  it('tells the user when more styles exist than it is showing', async () => {
    searchForPicker.mockResolvedValue({
      data: styles(200),
      pagination: { page: 1, limit: 200, total: 1116, totalPages: 6 },
    });

    render(<StyleCombobox value="" onChange={() => undefined} />);
    await waitFor(() => expect(searchForPicker).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText(/Showing 200 of 1,116/)).toBeInTheDocument();
  });

  it('shows no hint when everything fits', async () => {
    searchForPicker.mockResolvedValue({
      data: styles(3),
      pagination: { page: 1, limit: 200, total: 3, totalPages: 1 },
    });

    render(<StyleCombobox value="" onChange={() => undefined} />);
    await waitFor(() => expect(searchForPicker).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText(/LNG000/)).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
});
