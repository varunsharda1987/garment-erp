import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with placeholder', () => {
    render(<SearchInput value="" onChange={mockOnChange} placeholder="Search customers..." />);

    expect(screen.getByPlaceholderText('Search customers...')).toBeInTheDocument();
  });

  it('displays the current value', () => {
    render(<SearchInput value="test query" onChange={mockOnChange} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test query');
  });

  it('debounces onChange calls', async () => {
    render(<SearchInput value="" onChange={mockOnChange} debounceMs={300} />);

    const input = screen.getByRole('textbox');

    // Type multiple characters quickly
    fireEvent.change(input, { target: { value: 't' } });
    fireEvent.change(input, { target: { value: 'te' } });
    fireEvent.change(input, { target: { value: 'tes' } });
    fireEvent.change(input, { target: { value: 'test' } });

    // onChange should not be called yet
    expect(mockOnChange).not.toHaveBeenCalled();

    // Fast forward time
    vi.advanceTimersByTime(300);

    // Now onChange should be called once with the final value
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('test');
    });
  });

  it('shows clear button when input has value', () => {
    render(<SearchInput value="test" onChange={mockOnChange} />);

    const clearButton = screen.getByRole('button');
    expect(clearButton).toBeInTheDocument();
  });

  it('does not show clear button when input is empty', () => {
    render(<SearchInput value="" onChange={mockOnChange} />);

    const clearButton = screen.queryByRole('button');
    expect(clearButton).not.toBeInTheDocument();
  });

  it('clears input when clear button is clicked', async () => {
    render(<SearchInput value="test" onChange={mockOnChange} />);

    const clearButton = screen.getByRole('button');
    fireEvent.click(clearButton);

    // Should call onChange with empty string immediately (not debounced)
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('syncs with external value changes', () => {
    const { rerender } = render(<SearchInput value="initial" onChange={mockOnChange} />);

    let input = screen.getByRole('textbox');
    expect(input).toHaveValue('initial');

    // Update value externally
    rerender(<SearchInput value="updated" onChange={mockOnChange} />);

    input = screen.getByRole('textbox');
    expect(input).toHaveValue('updated');
  });
});
