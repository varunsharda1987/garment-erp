import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import EmptyState from './EmptyState';
import { Package } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title correctly', () => {
    render(<EmptyState title="No data found" />);

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="No customers" description="Get started by creating your first customer" />);

    expect(screen.getByText('Get started by creating your first customer')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<EmptyState title="No data" icon={<Package data-testid="package-icon" />} />);

    expect(screen.getByTestId('package-icon')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const mockAction = vi.fn();

    render(<EmptyState title="No data" actionLabel="Create New" onAction={mockAction} />);

    const button = screen.getByRole('button', { name: /create new/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', () => {
    const mockAction = vi.fn();

    render(<EmptyState title="No data" actionLabel="Create New" onAction={mockAction} />);

    const button = screen.getByRole('button', { name: /create new/i });
    fireEvent.click(button);

    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when onAction is not provided', () => {
    render(<EmptyState title="No data" actionLabel="Create New" />);

    const button = screen.queryByRole('button');
    expect(button).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState title="No data" className="custom-class" />);

    const card = container.firstChild;
    expect(card).toHaveClass('custom-class');
  });
});
