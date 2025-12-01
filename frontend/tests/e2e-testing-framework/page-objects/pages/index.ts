/**
 * Page Objects Index
 * Export all page objects for easy importing
 */

// Customer Pages
export {
  CustomerListPage,
  CustomerFormPage,
  CustomerDetailPage,
  createCustomerListPage,
  createCustomerFormPage,
  createCustomerDetailPage,
} from './customer-pages';

// Re-export base classes
export { BasePage } from '../base-page';
export { FormPage } from '../form-page';
export { ListPage } from '../list-page';

// Page factory type
import { Page } from '@playwright/test';
import { CustomerListPage, CustomerFormPage } from './customer-pages';

/**
 * Page Factory
 * Creates page objects for all pages in the application
 */
export class PageFactory {
  constructor(private page: Page) {}

  // Customer pages
  customerList(): CustomerListPage {
    return new CustomerListPage(this.page);
  }

  customerForm(): CustomerFormPage {
    return new CustomerFormPage(this.page);
  }

  // Add more page factories here as needed
  // supplierList(): SupplierListPage { ... }
  // materialForm(): MaterialFormPage { ... }
  // etc.
}

export function createPageFactory(page: Page): PageFactory {
  return new PageFactory(page);
}
