import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with necessary providers
 */
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <BrowserRouter>{children}</BrowserRouter>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render method
export { customRender as render };

/**
 * Mock API responses for testing
 */
export const mockApiResponse = <T,>(data: T, pagination?: any) => ({
  data,
  pagination: pagination || {
    page: 1,
    limit: 10,
    total: Array.isArray(data) ? data.length : 1,
    totalPages: 1,
  },
});

/**
 * Create mock customer data
 */
export const createMockCustomer = (overrides = {}) => ({
  id: '1',
  code: 'CUST001',
  name: 'Test Customer',
  type: 'BUYER',
  category: 'DOMESTIC',
  email: 'test@example.com',
  phone: '9876543210',
  contactPerson: 'John Doe',
  gstNumber: '22AAAAA0000A1Z5',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: {
    orders: 5,
    quotations: 3,
    invoices: 2,
  },
  ...overrides,
});

/**
 * Create mock supplier data
 */
export const createMockSupplier = (overrides = {}) => ({
  id: '1',
  code: 'SUP001',
  name: 'Test Supplier',
  category: 'FABRIC',
  email: 'supplier@example.com',
  phone: '9876543210',
  contactPerson: 'Jane Doe',
  rating: 4,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  _count: {
    purchaseOrders: 10,
    materials: 5,
  },
  ...overrides,
});

/**
 * Wait for async operations
 */
export const waitForAsync = () =>
  new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock toast notifications
 */
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
};

// Mock sonner
vi.mock('sonner', () => ({
  toast: mockToast,
  Toaster: () => null,
}));
