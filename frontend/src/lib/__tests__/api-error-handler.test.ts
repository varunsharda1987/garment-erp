import { describe, it, expect } from 'vitest';
import { getErrorMessage, getValidationErrors } from '../api-error-handler';

/**
 * A rejected save used to reach the operator as the constant "Invalid request data" — the toast
 * said nothing about which field or why, which is the whole reason the /validation-rejections
 * skill exists to mine that information back out of the server logs. getErrorMessage now prefers
 * the per-field `details` the API has been sending all along.
 */
const validation = (details: unknown, message = 'Invalid request data') => ({
  response: { status: 400, data: { error: 'Validation Error', message, details } },
});

describe('getErrorMessage', () => {
  it('shows the field-level text instead of the generic validation message', () => {
    const err = validation([{ field: 'quantity', message: 'Required' }]);
    expect(getErrorMessage(err)).toBe('Quantity: Required');
  });

  it('names the row for an array field, and drops the Id suffix nobody types', () => {
    const err = validation([
      {
        field: 'skuOutputs.0.colorId',
        message: 'Required — open the style and set its Primary Color, and it fills in here automatically.',
      },
    ]);
    expect(getErrorMessage(err)).toBe(
      'Color (row 1): Required — open the style and set its Primary Color, and it fills in here automatically.'
    );
  });

  it('splits camelCase field names into words', () => {
    expect(getErrorMessage(validation([{ field: 'expectedShipDate', message: 'Invalid date' }]))).toBe(
      'Expected Ship Date: Invalid date'
    );
  });

  it('caps a long list so the toast stays readable', () => {
    const err = validation(['a', 'b', 'c', 'd', 'e'].map((f) => ({ field: f, message: 'Required' })));
    expect(getErrorMessage(err)).toBe('A: Required · B: Required · C: Required · +2 more');
  });

  it('accepts the record form of details as well as the array form', () => {
    expect(getErrorMessage(validation({ styleId: 'Required' }))).toBe('Style: Required');
  });

  it('falls back to the top-level message when details carry nothing usable', () => {
    expect(getErrorMessage(validation([]))).toBe('Invalid request data');
    expect(getErrorMessage(validation(undefined))).toBe('Invalid request data');
    expect(getErrorMessage(validation({ nested: { deep: true } }))).toBe('Invalid request data');
  });

  it('leaves non-validation errors alone', () => {
    const err = { response: { status: 409, data: { error: 'Conflict', message: 'Style code already exists' } } };
    expect(getErrorMessage(err)).toBe('Style code already exists');
  });

  it('still handles plain Errors and strings', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('boom')).toBe('boom');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });
});

describe('getValidationErrors', () => {
  it('still maps details to raw field paths for forms that bind per-field errors', () => {
    const err = validation([{ field: 'skuOutputs.0.colorId', message: 'Required' }]);
    // Form binding needs the untouched path, not the humanized label.
    expect(getValidationErrors(err)).toEqual({ 'skuOutputs.0.colorId': 'Required' });
  });
});
