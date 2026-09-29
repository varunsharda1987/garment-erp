/**
 * StyleColourCombobox is the colour filter on the Finished Goods Stock page. FG stock's colorId is a style's
 * colour option (color_options), not a colour-master colour, so the picker lists ONE style's colours, read
 * from GET /styles/:id. It follows the picker contract: `allowAll` puts an "All …" row first whose value ''
 * means "no filter"; with no style it is disabled and says why.
 */
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StyleColourCombobox } from '@/components/StyleColourCombobox';
import { styleService } from '@/services/style.service';

vi.mock('@/services/style.service', () => ({ styleService: { getStyleById: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

/** The trigger button — `hidden` because the open (modal) list hides the rest of the page from the a11y tree */
const trigger = () => screen.getAllByRole('combobox', { hidden: true }).find((el) => el.tagName === 'BUTTON')!;
/** Longer than the combobox's 300 ms search debounce */
const settle = () => act(() => new Promise((r) => setTimeout(r, 450)));

const kurta = {
  id: 'sty-1',
  styleCode: 'LNG001',
  colorOptions: [
    { id: 'co-2', colorName: 'Plum', colorCode: 'CLR137', isActive: true, sortOrder: 0 },
    { id: 'co-1', colorName: 'Beige', colorCode: 'CLR005', isActive: true, sortOrder: 1 },
    { id: 'co-3', colorName: 'Indigo', colorCode: 'CLR027', isActive: false, sortOrder: 2 },
  ],
};
const dress = {
  id: 'sty-2',
  styleCode: 'DRS002',
  colorOptions: [{ id: 'co-9', colorName: 'Denim Blue', colorCode: 'CLR028', isActive: true, sortOrder: 0 }],
};

describe('StyleColourCombobox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('with no style it is disabled, says "Pick a style first" and fetches nothing', async () => {
    render(<StyleColourCombobox value="" onValueChange={() => undefined} allowAll placeholder="All colours" />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Pick a style first'));
    expect(trigger()).toBeDisabled();
    expect(styleService.getStyleById).not.toHaveBeenCalled();
  });

  it('lists the style\'s colours in its own order, marks an inactive one, and "All colours" clears', async () => {
    mocked(styleService.getStyleById).mockResolvedValue(kurta);
    const onValue = vi.fn();
    function Filter() {
      const [colorId, setColorId] = useState('co-1');
      return (
        <StyleColourCombobox
          styleId="sty-1"
          value={colorId}
          onValueChange={(v, colour) => {
            onValue(v, colour);
            setColorId(v);
          }}
          allowAll
          placeholder="All colours"
          className="w-[200px]"
        />
      );
    }
    render(<Filter />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Beige'));
    expect(trigger()).toHaveClass('w-[200px]');
    expect(styleService.getStyleById).toHaveBeenCalledWith('sty-1');

    fireEvent.click(trigger());
    const names = (await screen.findAllByRole('option')).map((option) => option.textContent?.trim());
    expect(names).toEqual(['All colours', 'Plum', 'Beige', 'Indigo (inactive)']);

    fireEvent.click(screen.getByRole('option', { name: 'All colours' }));
    expect(onValue).toHaveBeenLastCalledWith('', undefined);
    await waitFor(() => expect(trigger()).toHaveTextContent('All colours'));

    // …and picking a colour hands back its id and the record
    fireEvent.click(trigger());
    fireEvent.click(await screen.findByRole('option', { name: 'Plum' }));
    expect(onValue).toHaveBeenLastCalledWith('co-2', expect.objectContaining({ id: 'co-2', colorName: 'Plum' }));
  });

  it('typing searches the loaded colours in memory — name or master code', async () => {
    mocked(styleService.getStyleById).mockResolvedValue(kurta);
    render(<StyleColourCombobox styleId="sty-1" value="" onValueChange={() => undefined} allowAll />);
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: 'Plum' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search colour...'), { target: { value: 'clr005' } });
    await settle();
    expect(screen.getByRole('option', { name: 'Beige' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Plum' })).not.toBeInTheDocument();
    expect(styleService.getStyleById).toHaveBeenCalledTimes(1); // the typed search did not refetch
  });

  it('a new style loads that style’s colours', async () => {
    mocked(styleService.getStyleById).mockImplementation(async (id: string) => (id === 'sty-1' ? kurta : dress));
    const { rerender } = render(
      <StyleColourCombobox styleId="sty-1" value="" onValueChange={() => undefined} allowAll />
    );
    await waitFor(() => expect(styleService.getStyleById).toHaveBeenCalledWith('sty-1'));

    rerender(<StyleColourCombobox styleId="sty-2" value="" onValueChange={() => undefined} allowAll />);
    await waitFor(() => expect(styleService.getStyleById).toHaveBeenLastCalledWith('sty-2'));
    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: 'Denim Blue' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Plum' })).not.toBeInTheDocument();
  });

  it('a failed load says so and retries when the list is opened again', async () => {
    mocked(styleService.getStyleById).mockRejectedValueOnce(new Error('API restarting')).mockResolvedValue(kurta);
    render(<StyleColourCombobox styleId="sty-1" value="" onValueChange={() => undefined} placeholder="All colours" />);
    await waitFor(() => expect(trigger()).toHaveTextContent('Could not load — open to retry'));

    fireEvent.click(trigger());
    expect(await screen.findByRole('option', { name: 'Plum' })).toBeInTheDocument();
    expect(styleService.getStyleById).toHaveBeenCalledTimes(2);
  });
});
