/**
 * Unit Tests for Pagination Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

describe('Pagination Component', () => {
  const mockOnPageChange = vi.fn();

  beforeEach(() => {
    mockOnPageChange.mockClear();
  });

  it('should render pagination controls', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />);

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 5/i)).toBeInTheDocument();
  });

  it('should disable Previous button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />);

    const previousButton = screen.getByText('Previous').closest('button');
    expect(previousButton).toBeDisabled();
  });

  it('should disable Next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={mockOnPageChange} />);

    const nextButton = screen.getByText('Next').closest('button');
    expect(nextButton).toBeDisabled();
  });

  it('should call onPageChange with correct page number when clicking Next', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={mockOnPageChange} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(3);
    expect(mockOnPageChange).toHaveBeenCalledTimes(1);
  });

  it('should call onPageChange with correct page number when clicking Previous', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={mockOnPageChange} />);

    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
    expect(mockOnPageChange).toHaveBeenCalledTimes(1);
  });

  it('should render correctly with single page', () => {
    render(<Pagination currentPage={1} totalPages={1} onPageChange={mockOnPageChange} />);

    const previousButton = screen.getByText('Previous').closest('button');
    const nextButton = screen.getByText('Next').closest('button');

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
    expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
  });

  it('should render correctly with zero pages', () => {
    render(<Pagination currentPage={1} totalPages={0} onPageChange={mockOnPageChange} />);

    const previousButton = screen.getByText('Previous').closest('button');
    const nextButton = screen.getByText('Next').closest('button');

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('should not call onPageChange when clicking disabled buttons', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={mockOnPageChange} />);

    const previousButton = screen.getByText('Previous');
    fireEvent.click(previousButton);

    expect(mockOnPageChange).not.toHaveBeenCalled();
  });
});
