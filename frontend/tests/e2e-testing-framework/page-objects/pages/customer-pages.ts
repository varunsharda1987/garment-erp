import { Page } from '@playwright/test';
import { ListPage } from '../list-page';
import { FormPage } from '../form-page';
import { FormDefinition, FieldDefinition } from '../../core/field-validator';
import { FieldType, PageRoutes } from '../../config/test-config';

/**
 * Customer List Page Object
 */
export class CustomerListPage extends ListPage {
  constructor(page: Page) {
    super(page);
  }

  get urlPattern(): RegExp {
    return /\/customers\/?$/;
  }

  get createButtonLabel(): string | RegExp {
    return /add|create.*customer|new customer/i;
  }

  get createPageUrl(): string {
    return '/customers/new';
  }

  async goto(): Promise<void> {
    await this.page.goto(PageRoutes.customers);
    await this.waitForLoad();
  }

  /**
   * Get expected table headers for customers
   */
  getExpectedHeaders(): string[] {
    return ['Code', 'Name', 'Contact', 'Email', 'Phone', 'Category'];
  }
}

/**
 * Customer Form Field Definitions
 */
const customerFormFields: FieldDefinition[] = [
  {
    name: 'code',
    label: /customer code|code/i,
    type: FieldType.TEXT,
    required: true,
  },
  {
    name: 'name',
    label: /company name|customer name|name/i,
    type: FieldType.TEXT,
    required: true,
    validation: {
      minLength: 2,
      maxLength: 255,
    },
  },
  {
    name: 'type',
    label: /customer type|type/i,
    type: FieldType.SELECT,
    required: true,
    options: ['BUYER'],
  },
  {
    name: 'category',
    label: /category/i,
    type: FieldType.SELECT,
    required: true,
    options: ['DOMESTIC', 'EXPORT', 'LOCAL'],
  },
  {
    name: 'businessType',
    label: /business type/i,
    type: FieldType.SELECT,
    required: false,
    options: ['B2B', 'B2C'],
  },
  {
    name: 'market',
    label: /market/i,
    type: FieldType.SELECT,
    required: false,
    options: ['INTERNATIONAL', 'DOMESTIC'],
  },
  {
    name: 'contactPerson',
    label: /contact person|contact/i,
    type: FieldType.TEXT,
    required: false,
  },
  {
    name: 'email',
    label: /email/i,
    type: FieldType.EMAIL,
    required: false,
    validation: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
  },
  {
    name: 'phone',
    label: /phone|mobile/i,
    type: FieldType.PHONE,
    required: false,
    validation: {
      maxLength: 20,
    },
  },
  {
    name: 'billingAddress',
    label: /billing address/i,
    type: FieldType.TEXTAREA,
    required: false,
  },
  {
    name: 'shippingAddress',
    label: /shipping address/i,
    type: FieldType.TEXTAREA,
    required: false,
  },
  {
    name: 'gstNumber',
    label: /gst number|gst/i,
    type: FieldType.GST,
    required: false,
    validation: {
      pattern: /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    },
  },
  {
    name: 'creditLimit',
    label: /credit limit/i,
    type: FieldType.DECIMAL,
    required: false,
    validation: {
      min: 0,
    },
  },
  {
    name: 'creditDays',
    label: /credit days/i,
    type: FieldType.NUMBER,
    required: false,
    validation: {
      min: 0,
      max: 365,
    },
  },
];

/**
 * Customer Create Form Page Object
 */
export class CustomerFormPage extends FormPage {
  constructor(page: Page) {
    super(page);
  }

  get urlPattern(): RegExp {
    return /\/customers\/(new|[a-f0-9-]+\/edit)/;
  }

  get listPageUrl(): RegExp {
    return /\/customers\/?$/;
  }

  get formDefinition(): FormDefinition {
    return {
      name: 'Customer',
      route: '/customers/new',
      fields: customerFormFields,
      submitButton: /create.*customer|save|update/i,
      cancelButton: /cancel/i,
    };
  }

  async goto(): Promise<void> {
    await this.page.goto(PageRoutes.customerCreate);
    await this.waitForLoad();
  }

  async gotoEdit(id: string): Promise<void> {
    await this.page.goto(PageRoutes.customerEdit(id));
    await this.waitForLoad();
  }

  /**
   * Test email field validation
   */
  async testEmailValidation(): Promise<void> {
    const invalidEmails = ['invalid', 'invalid@', '@example.com', 'test@.com'];
    await this.testFieldValidation('email', invalidEmails, 'test@example.com');
  }

  /**
   * Test GST field validation
   */
  async testGSTValidation(): Promise<void> {
    const invalidGST = ['INVALID', '12345', 'ABCDEFGHIJKLMNO'];
    await this.testFieldValidation('gstNumber', invalidGST, '22AAAAA0000A1Z5');
  }

  /**
   * Test credit days validation
   */
  async testCreditDaysValidation(): Promise<void> {
    const invalidValues = ['-1', '366', '1000'];
    await this.testFieldValidation('creditDays', invalidValues, '30');
  }
}

/**
 * Customer Detail Page Object
 */
export class CustomerDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get urlPattern(): RegExp {
    return /\/customers\/[a-f0-9-]+$/;
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(PageRoutes.customerDetail(id));
    await this.waitForLoad();
  }

  /**
   * Get customer name from detail page
   */
  async getCustomerName(): Promise<string> {
    const nameElement = this.page.locator('h1, [data-testid="customer-name"]').first();
    return (await nameElement.textContent()) || '';
  }

  /**
   * Get edit button
   */
  get editButton(): Locator {
    return this.page.getByRole('button', { name: /edit/i });
  }

  /**
   * Click edit button
   */
  async clickEdit(): Promise<void> {
    await this.editButton.click();
    await this.page.waitForURL(/\/edit$/);
  }
}

// Export page factory functions
export function createCustomerListPage(page: Page): CustomerListPage {
  return new CustomerListPage(page);
}

export function createCustomerFormPage(page: Page): CustomerFormPage {
  return new CustomerFormPage(page);
}

export function createCustomerDetailPage(page: Page): CustomerDetailPage {
  return new CustomerDetailPage(page);
}

// Need to import Locator and BasePage
import { Locator } from '@playwright/test';
import { BasePage } from '../base-page';
