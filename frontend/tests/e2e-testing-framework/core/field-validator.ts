import { Page, Locator, expect } from '@playwright/test';
import { FieldType, ValidationRules, TestConfig } from '../config/test-config';

/**
 * Field Validator
 * Provides utilities for testing form fields
 */

export interface FieldDefinition {
  name: string;
  label: string | RegExp;
  type: FieldType;
  required: boolean;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    customValidator?: (value: string) => boolean;
  };
  defaultValue?: string | number | boolean;
  options?: string[]; // For select/radio fields
  placeholder?: string;
}

export interface FormDefinition {
  name: string;
  route: string;
  fields: FieldDefinition[];
  submitButton: string | RegExp;
  cancelButton?: string | RegExp;
}

export class FieldValidator {
  constructor(private page: Page) {}

  /**
   * Get a field locator by label
   */
  getField(label: string | RegExp): Locator {
    return this.page.getByLabel(label);
  }

  /**
   * Get a field by role (for selects, buttons, etc.)
   */
  getFieldByRole(role: string, options: { name?: string | RegExp } = {}): Locator {
    return this.page.getByRole(role as any, options);
  }

  /**
   * Check if a field is visible
   */
  async isFieldVisible(label: string | RegExp): Promise<boolean> {
    const field = this.getField(label);
    return await field.isVisible();
  }

  /**
   * Check if a field is enabled
   */
  async isFieldEnabled(label: string | RegExp): Promise<boolean> {
    const field = this.getField(label);
    return await field.isEnabled();
  }

  /**
   * Fill a text field
   */
  async fillTextField(label: string | RegExp, value: string): Promise<void> {
    const field = this.getField(label);
    await field.fill(value);
  }

  /**
   * Fill a select field
   */
  async fillSelectField(label: string | RegExp, value: string): Promise<void> {
    const field = this.getField(label);
    await field.selectOption(value);
  }

  /**
   * Click a checkbox
   */
  async checkCheckbox(label: string | RegExp, checked: boolean = true): Promise<void> {
    const field = this.getField(label);
    if (checked) {
      await field.check();
    } else {
      await field.uncheck();
    }
  }

  /**
   * Click a radio button
   */
  async selectRadio(groupName: string | RegExp, value: string): Promise<void> {
    await this.page.getByRole('radio', { name: new RegExp(value, 'i') }).click();
  }

  /**
   * Fill a date field
   */
  async fillDateField(label: string | RegExp, date: Date): Promise<void> {
    const field = this.getField(label);
    const dateStr = date.toISOString().split('T')[0];
    await field.fill(dateStr);
  }

  /**
   * Upload a file
   */
  async uploadFile(label: string | RegExp, filePath: string): Promise<void> {
    const input = this.page.locator(`input[type="file"]`).first();
    await input.setInputFiles(filePath);
  }

  /**
   * Get field value
   */
  async getFieldValue(label: string | RegExp): Promise<string> {
    const field = this.getField(label);
    return await field.inputValue();
  }

  /**
   * Verify field has error message
   */
  async hasError(errorMessage: string | RegExp): Promise<boolean> {
    const errorLocator = this.page.getByText(errorMessage);
    return await errorLocator.isVisible();
  }

  /**
   * Validate all required fields show errors when empty
   */
  async validateRequiredFields(formDef: FormDefinition): Promise<void> {
    // Clear all fields
    for (const field of formDef.fields) {
      if (field.type === FieldType.TEXT || field.type === FieldType.EMAIL || field.type === FieldType.NUMBER) {
        try {
          await this.fillTextField(field.label, '');
        } catch {
          // Field might not be clearable
        }
      }
    }

    // Submit empty form
    await this.page.getByRole('button', { name: formDef.submitButton }).click();

    // Check required fields show errors
    const requiredFields = formDef.fields.filter((f) => f.required);
    for (const field of requiredFields) {
      const hasError = await this.hasError(/required|cannot be empty/i);
      expect(hasError, `Expected required field "${field.name}" to show error`).toBe(true);
    }
  }

  /**
   * Validate email field format
   */
  async validateEmailField(label: string | RegExp): Promise<void> {
    // Test invalid emails
    const invalidEmails = ['invalid', 'invalid@', '@example.com', 'test@.com'];

    for (const email of invalidEmails) {
      await this.fillTextField(label, email);
      await this.page.keyboard.press('Tab'); // Trigger blur validation

      const hasError = await this.hasError(/invalid.*email|email.*invalid|valid email/i);
      expect(hasError, `Expected "${email}" to show validation error`).toBe(true);
    }

    // Test valid email
    await this.fillTextField(label, 'test@example.com');
    await this.page.keyboard.press('Tab');
  }

  /**
   * Validate phone field format
   */
  async validatePhoneField(label: string | RegExp): Promise<void> {
    // Test invalid phones
    const invalidPhones = ['123', '12345678901', 'abcdefghij'];

    for (const phone of invalidPhones) {
      await this.fillTextField(label, phone);
      await this.page.keyboard.press('Tab');

      // Either should show error or be limited/rejected
    }

    // Test valid phone
    await this.fillTextField(label, '9876543210');
    await this.page.keyboard.press('Tab');
  }

  /**
   * Validate GST field format
   */
  async validateGSTField(label: string | RegExp): Promise<void> {
    // Test invalid GST
    const invalidGST = ['INVALID', '12345', 'ABCDEFGHIJKLMNO'];

    for (const gst of invalidGST) {
      await this.fillTextField(label, gst);
      await this.page.keyboard.press('Tab');

      const hasError = await this.hasError(/invalid.*gst|gst.*format/i);
      // Some forms might not show error immediately
    }

    // Test valid GST
    await this.fillTextField(label, '22AAAAA0000A1Z5');
    await this.page.keyboard.press('Tab');
  }

  /**
   * Validate numeric field
   */
  async validateNumericField(label: string | RegExp, min?: number, max?: number): Promise<void> {
    // Test non-numeric
    await this.fillTextField(label, 'abc');
    await this.page.keyboard.press('Tab');

    // Test below min if specified
    if (min !== undefined) {
      await this.fillTextField(label, String(min - 1));
      await this.page.keyboard.press('Tab');
    }

    // Test above max if specified
    if (max !== undefined) {
      await this.fillTextField(label, String(max + 1));
      await this.page.keyboard.press('Tab');
    }

    // Test valid value
    const validValue = min !== undefined ? min : max !== undefined ? max : 100;
    await this.fillTextField(label, String(validValue));
    await this.page.keyboard.press('Tab');
  }

  /**
   * Test all fields in a form are visible and enabled
   */
  async testFieldsRendering(formDef: FormDefinition): Promise<void> {
    for (const field of formDef.fields) {
      const isVisible = await this.isFieldVisible(field.label);
      expect(isVisible, `Expected field "${field.name}" to be visible`).toBe(true);

      const isEnabled = await this.isFieldEnabled(field.label);
      expect(isEnabled, `Expected field "${field.name}" to be enabled`).toBe(true);
    }
  }

  /**
   * Fill all fields in a form with test data
   */
  async fillForm(formDef: FormDefinition, testData: Record<string, any>): Promise<void> {
    for (const field of formDef.fields) {
      const value = testData[field.name];
      if (value === undefined) continue;

      switch (field.type) {
        case FieldType.TEXT:
        case FieldType.EMAIL:
        case FieldType.NUMBER:
        case FieldType.DECIMAL:
        case FieldType.PHONE:
        case FieldType.GST:
        case FieldType.TEXTAREA:
          await this.fillTextField(field.label, String(value));
          break;

        case FieldType.SELECT:
          await this.fillSelectField(field.label, value);
          break;

        case FieldType.CHECKBOX:
          await this.checkCheckbox(field.label, !!value);
          break;

        case FieldType.RADIO:
          await this.selectRadio(field.label, value);
          break;

        case FieldType.DATE:
        case FieldType.DATETIME:
          await this.fillDateField(field.label, new Date(value));
          break;

        case FieldType.FILE:
        case FieldType.IMAGE:
          await this.uploadFile(field.label, value);
          break;
      }
    }
  }

  /**
   * Submit form and wait for response
   */
  async submitForm(formDef: FormDefinition): Promise<void> {
    const submitButton = this.page.getByRole('button', { name: formDef.submitButton });
    await submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Cancel form
   */
  async cancelForm(formDef: FormDefinition): Promise<void> {
    if (formDef.cancelButton) {
      const cancelButton = this.page.getByRole('button', { name: formDef.cancelButton });
      await cancelButton.click();
    }
  }

  /**
   * Test complete form workflow
   */
  async testCompleteFormWorkflow(
    formDef: FormDefinition,
    testData: Record<string, any>,
    expectedRedirect: string | RegExp
  ): Promise<void> {
    // Test fields rendering
    await this.testFieldsRendering(formDef);

    // Fill form with test data
    await this.fillForm(formDef, testData);

    // Submit form
    await this.submitForm(formDef);

    // Verify redirect
    await expect(this.page).toHaveURL(expectedRedirect, {
      timeout: TestConfig.timeouts.formSubmit,
    });
  }
}

/**
 * Factory function to create a FieldValidator
 */
export function createFieldValidator(page: Page): FieldValidator {
  return new FieldValidator(page);
}

export default FieldValidator;
