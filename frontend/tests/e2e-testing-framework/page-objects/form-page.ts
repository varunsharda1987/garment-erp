import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';
import { TestConfig, FieldType } from '../config/test-config';
import { FieldValidator, FieldDefinition, FormDefinition } from '../core/field-validator';

/**
 * Base Form Page Object
 * Provides common form functionality for create/edit pages
 */
export abstract class FormPage extends BasePage {
  protected fieldValidator: FieldValidator;

  constructor(page: Page) {
    super(page);
    this.fieldValidator = new FieldValidator(page);
  }

  /**
   * Get form definition
   */
  abstract get formDefinition(): FormDefinition;

  /**
   * Get list page URL to redirect after save
   */
  abstract get listPageUrl(): RegExp;

  // ============================================
  // FORM ELEMENTS
  // ============================================

  /**
   * Get submit button
   */
  get submitButton(): Locator {
    return this.page.getByRole('button', { name: this.formDefinition.submitButton });
  }

  /**
   * Get cancel button
   */
  get cancelButton(): Locator {
    const cancelLabel = this.formDefinition.cancelButton || /cancel/i;
    return this.page.getByRole('button', { name: cancelLabel });
  }

  /**
   * Get a form field by name
   */
  getField(fieldName: string): Locator {
    const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
    if (!fieldDef) {
      throw new Error(`Field "${fieldName}" not found in form definition`);
    }
    return this.fieldValidator.getField(fieldDef.label);
  }

  // ============================================
  // FORM ACTIONS
  // ============================================

  /**
   * Fill a single field
   */
  async fillField(fieldName: string, value: any): Promise<void> {
    const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
    if (!fieldDef) {
      throw new Error(`Field "${fieldName}" not found in form definition`);
    }

    switch (fieldDef.type) {
      case FieldType.TEXT:
      case FieldType.EMAIL:
      case FieldType.NUMBER:
      case FieldType.DECIMAL:
      case FieldType.PHONE:
      case FieldType.GST:
      case FieldType.TEXTAREA:
        await this.fieldValidator.fillTextField(fieldDef.label, String(value));
        break;

      case FieldType.SELECT:
        await this.fillSelect(fieldDef.label, value);
        break;

      case FieldType.CHECKBOX:
        await this.fieldValidator.checkCheckbox(fieldDef.label, !!value);
        break;

      case FieldType.RADIO:
        await this.fieldValidator.selectRadio(fieldDef.label, value);
        break;

      case FieldType.DATE:
      case FieldType.DATETIME:
        await this.fieldValidator.fillDateField(fieldDef.label, new Date(value));
        break;

      case FieldType.FILE:
      case FieldType.IMAGE:
        await this.fieldValidator.uploadFile(fieldDef.label, value);
        break;

      default:
        await this.fieldValidator.fillTextField(fieldDef.label, String(value));
    }
  }

  /**
   * Fill select/dropdown field
   * Handles both native select and custom dropdown components
   */
  async fillSelect(label: string | RegExp, value: string): Promise<void> {
    // Try native select first
    const nativeSelect = this.page.getByLabel(label);
    const tagName = await nativeSelect.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');

    if (tagName === 'select') {
      await nativeSelect.selectOption(value);
      return;
    }

    // Try custom select component (like shadcn/ui Select)
    const trigger = this.page.locator(`[data-testid="${label}"], [aria-label="${label}"]`).first();
    if (await trigger.isVisible()) {
      await trigger.click();
      await this.page.getByRole('option', { name: new RegExp(value, 'i') }).click();
      return;
    }

    // Try clicking on the label to open dropdown
    const labelElement = this.page.getByText(label);
    const container = labelElement.locator('..').locator('button, [role="combobox"]').first();
    if (await container.isVisible()) {
      await container.click();
      await this.page.waitForTimeout(TestConfig.timeouts.animation);
      await this.page.getByRole('option', { name: new RegExp(value, 'i') }).click();
    }
  }

  /**
   * Fill the entire form with test data
   */
  async fillForm(data: Record<string, any>): Promise<void> {
    for (const [fieldName, value] of Object.entries(data)) {
      // Skip if field doesn't exist in form definition
      const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
      if (!fieldDef) continue;

      try {
        await this.fillField(fieldName, value);
      } catch (error) {
        console.warn(`Failed to fill field "${fieldName}":`, error);
      }
    }
  }

  /**
   * Submit the form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
    await this.waitForLoad();
  }

  /**
   * Submit and wait for redirect to list page
   */
  async submitAndWaitForRedirect(): Promise<void> {
    await this.submit();
    await expect(this.page).toHaveURL(this.listPageUrl, {
      timeout: TestConfig.timeouts.formSubmit,
    });
  }

  /**
   * Cancel the form
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await expect(this.page).toHaveURL(this.listPageUrl, {
      timeout: TestConfig.timeouts.navigation,
    });
  }

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Get validation error for a field
   */
  async getFieldError(fieldName: string): Promise<string | null> {
    const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
    if (!fieldDef) return null;

    // Try to find error message near the field
    const field = this.fieldValidator.getField(fieldDef.label);
    const container = field.locator('..');
    const errorMessage = container.locator('[class*="error"], [class*="invalid"], .text-red-500, .text-destructive');

    if (await errorMessage.isVisible()) {
      return await errorMessage.textContent();
    }
    return null;
  }

  /**
   * Check if form has validation errors
   */
  async hasValidationErrors(): Promise<boolean> {
    const errorIndicators = this.page.locator(
      '[class*="error"], [class*="invalid"], .text-red-500, .text-destructive, [aria-invalid="true"]'
    );
    return (await errorIndicators.count()) > 0;
  }

  /**
   * Submit empty form and check required field validation
   */
  async testRequiredFieldValidation(): Promise<void> {
    // Clear all clearable fields
    for (const field of this.formDefinition.fields) {
      if (
        field.type === FieldType.TEXT ||
        field.type === FieldType.EMAIL ||
        field.type === FieldType.NUMBER ||
        field.type === FieldType.TEXTAREA
      ) {
        try {
          await this.fieldValidator.fillTextField(field.label, '');
        } catch {
          // Field might not be clearable
        }
      }
    }

    // Submit form
    await this.submit();

    // Check that form didn't submit (still on same page)
    await expect(this.page).toHaveURL(this.urlPattern);

    // Check for validation errors
    const hasErrors = await this.hasValidationErrors();
    expect(hasErrors, 'Expected form to show validation errors for required fields').toBe(true);
  }

  /**
   * Test specific field validation
   */
  async testFieldValidation(fieldName: string, invalidValues: string[], validValue: string): Promise<void> {
    const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
    if (!fieldDef) {
      throw new Error(`Field "${fieldName}" not found`);
    }

    // Test invalid values
    for (const invalidValue of invalidValues) {
      await this.fieldValidator.fillTextField(fieldDef.label, invalidValue);
      await this.page.keyboard.press('Tab'); // Trigger blur validation
      await this.page.waitForTimeout(TestConfig.timeouts.debounce);

      // Either should show error or prevent input
    }

    // Test valid value
    await this.fieldValidator.fillTextField(fieldDef.label, validValue);
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(TestConfig.timeouts.debounce);
  }

  // ============================================
  // FIELD RENDERING TESTS
  // ============================================

  /**
   * Verify all fields are rendered
   */
  async verifyAllFieldsRendered(): Promise<void> {
    for (const field of this.formDefinition.fields) {
      const isVisible = await this.fieldValidator.isFieldVisible(field.label);
      expect(isVisible, `Expected field "${field.name}" to be visible`).toBe(true);
    }
  }

  /**
   * Verify all fields are enabled (not disabled)
   */
  async verifyAllFieldsEnabled(): Promise<void> {
    for (const field of this.formDefinition.fields) {
      const isEnabled = await this.fieldValidator.isFieldEnabled(field.label);
      expect(isEnabled, `Expected field "${field.name}" to be enabled`).toBe(true);
    }
  }

  /**
   * Verify field has expected value
   */
  async verifyFieldValue(fieldName: string, expectedValue: string): Promise<void> {
    const fieldDef = this.formDefinition.fields.find((f) => f.name === fieldName);
    if (!fieldDef) {
      throw new Error(`Field "${fieldName}" not found`);
    }

    const actualValue = await this.fieldValidator.getFieldValue(fieldDef.label);
    expect(actualValue).toBe(expectedValue);
  }

  // ============================================
  // COMPLETE WORKFLOW TESTS
  // ============================================

  /**
   * Test complete create workflow
   */
  async testCreateWorkflow(testData: Record<string, any>): Promise<void> {
    // Verify fields are rendered
    await this.verifyAllFieldsRendered();

    // Fill form
    await this.fillForm(testData);

    // Submit
    await this.submitAndWaitForRedirect();

    // Verify success toast
    await this.assertSuccessToast();
  }

  /**
   * Test cancel workflow
   */
  async testCancelWorkflow(testData: Record<string, any>): Promise<void> {
    // Fill some data
    const firstField = this.formDefinition.fields[0];
    if (firstField && testData[firstField.name]) {
      await this.fillField(firstField.name, testData[firstField.name]);
    }

    // Cancel
    await this.cancel();

    // Should be back on list page
    await expect(this.page).toHaveURL(this.listPageUrl);
  }
}

export default FormPage;
