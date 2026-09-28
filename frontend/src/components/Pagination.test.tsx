/**
 * Unit tests for the project's ONE shared pager (components/Pagination.tsx).
 *
 * The first / previous / next / last buttons are icon-only, so they are found by their
 * aria-labels ("First page", "Previous page", "Next page", "Last page"); numbered pages
 * by "Page N".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

/** The summary is split across <span>s, so match the whole line on its container. */
function summary(text: string) {
  return screen.getByText((_, el) => el?.tagName === 'DIV' && el.textContent === text);
}

const nav = {
  first: () => screen.getByRole('button', { name: 'First page' }),
  previous: () => screen.getByRole('button', { name: 'Previous page' }),
  next: () => screen.getByRole('button', { name: 'Next page' }),
  last: () => screen.getByRole('button', { name: 'Last page' }),
  page: (n: number) => screen.getByRole('button', { name: `Page ${n}` }),
};

describe('Pagination', () => {
  const onPageChange = vi.fn();

  beforeEach(() => {
    onPageChange.mockClear();
  });

  it('shows "Showing X to Y of Z results"', () => {
    render(<Pagination currentPage={2} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    expect(summary('Showing 11 to 20 of 45 results')).toBeInTheDocument();
  });

  it('caps the last page range at the total', () => {
    render(<Pagination currentPage={5} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    expect(summary('Showing 41 to 45 of 45 results')).toBeInTheDocument();
  });

  it('uses itemLabel in the summary', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        pageSize={10}
        totalItems={23}
        onPageChange={onPageChange}
        itemLabel="sets"
      />
    );

    expect(summary('Showing 1 to 10 of 23 sets')).toBeInTheDocument();
  });

  it('disables first / previous on page 1 and keeps next / last enabled', () => {
    render(<Pagination currentPage={1} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    expect(nav.first()).toBeDisabled();
    expect(nav.previous()).toBeDisabled();
    expect(nav.next()).toBeEnabled();
    expect(nav.last()).toBeEnabled();

    fireEvent.click(nav.previous());
    fireEvent.click(nav.first());
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables next / last on the last page and keeps first / previous enabled', () => {
    render(<Pagination currentPage={5} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    expect(nav.next()).toBeDisabled();
    expect(nav.last()).toBeDisabled();
    expect(nav.first()).toBeEnabled();
    expect(nav.previous()).toBeEnabled();

    fireEvent.click(nav.next());
    fireEvent.click(nav.last());
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables every arrow on a single page but still shows the summary', () => {
    render(<Pagination currentPage={1} totalPages={1} pageSize={20} totalItems={5} onPageChange={onPageChange} />);

    expect(summary('Showing 1 to 5 of 5 results')).toBeInTheDocument();
    expect(nav.first()).toBeDisabled();
    expect(nav.previous()).toBeDisabled();
    expect(nav.next()).toBeDisabled();
    expect(nav.last()).toBeDisabled();
  });

  it('calls onPageChange with the right page for next, previous, a numbered page, first and last', () => {
    render(<Pagination currentPage={3} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    fireEvent.click(nav.next());
    expect(onPageChange).toHaveBeenLastCalledWith(4);

    fireEvent.click(nav.previous());
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    fireEvent.click(nav.page(5));
    expect(onPageChange).toHaveBeenLastCalledWith(5);

    fireEvent.click(nav.first());
    expect(onPageChange).toHaveBeenLastCalledWith(1);

    fireEvent.click(nav.last());
    expect(onPageChange).toHaveBeenLastCalledWith(5);

    expect(onPageChange).toHaveBeenCalledTimes(5);
  });

  it('marks only the current page with aria-current="page"', () => {
    render(<Pagination currentPage={3} totalPages={5} pageSize={10} totalItems={45} onPageChange={onPageChange} />);

    expect(nav.page(3)).toHaveAttribute('aria-current', 'page');
    for (const n of [1, 2, 4, 5]) {
      expect(nav.page(n)).not.toHaveAttribute('aria-current');
    }
  });

  it('renders nothing when there are no items', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} pageSize={10} totalItems={0} onPageChange={onPageChange} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the page-size selector only when onPageSizeChange is given', () => {
    const { rerender } = render(
      <Pagination currentPage={1} totalPages={3} pageSize={20} totalItems={50} onPageChange={onPageChange} />
    );

    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
    expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();

    rerender(
      <Pagination
        currentPage={1}
        totalPages={3}
        pageSize={20}
        totalItems={50}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />
    );

    const sizeSelect = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(sizeSelect).toHaveTextContent('20');
    expect(screen.getByText('Rows per page:')).toBeInTheDocument();
  });

  it('names the page-size selector after a custom pageSizeLabel', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        pageSize={20}
        totalItems={50}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
        pageSizeLabel="Sets per page:"
      />
    );

    expect(screen.getByRole('combobox', { name: 'Sets per page' })).toBeInTheDocument();
  });

  it('collapses a long range with ellipses around the current page (20 pages, page 10)', () => {
    render(<Pagination currentPage={10} totalPages={20} pageSize={10} totalItems={200} onPageChange={onPageChange} />);

    for (const n of [1, 8, 9, 10, 11, 12, 20]) {
      expect(nav.page(n)).toBeInTheDocument();
    }
    for (const n of [2, 7, 13, 19]) {
      expect(screen.queryByRole('button', { name: `Page ${n}` })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText('...')).toHaveLength(2);
    expect(nav.page(10)).toHaveAttribute('aria-current', 'page');

    fireEvent.click(nav.page(20));
    expect(onPageChange).toHaveBeenCalledWith(20);
  });
});
