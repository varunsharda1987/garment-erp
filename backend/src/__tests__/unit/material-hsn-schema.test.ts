/**
 * A material's HSN code is 6 digits (8 allowed) — owner, 2026-09-28.
 *
 * The Materials API and every PO line (create, edit, add-item) refuse anything else with one message;
 * blank means "none sent" (the server fills a material's from its type, a PO line takes the material's).
 * The Material form checks the same pattern before it posts.
 */

import fs from 'fs';
import path from 'path';
import { createMaterialSchema, materialHsnCodeSchema, updateMaterialSchema } from '../../schemas/material.schema';
import {
  addPurchaseOrderItemSchema,
  purchaseOrderItemSchema,
  updatePurchaseOrderItemSchema,
} from '../../schemas/purchaseOrder.schema';
import { MATERIAL_HSN_PATTERN } from '../../services/helpers/material-hsn.helper';

const MESSAGE = 'HSN code must be 6 digits (8 allowed)';

const MATERIAL_FORM = path.join(__dirname, '..', '..', '..', '..', 'frontend', 'src', 'pages', 'MaterialForm.tsx');

describe('material HSN code', () => {
  it.each(['520812', '52081210', ' 580410 '])('accepts %p', (code) => {
    const parsed = materialHsnCodeSchema.safeParse(code);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe(code.trim());
  });

  it.each(['5208', '52081', '5208121', '520812100', '52O812', '5208.12', 'cotton'])('refuses %p', (code) => {
    const parsed = materialHsnCodeSchema.safeParse(code);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe(MESSAGE);
  });

  it('reads blank as none (null), and absent stays absent', () => {
    expect(materialHsnCodeSchema.parse('')).toBeNull();
    expect(materialHsnCodeSchema.parse('   ')).toBeNull();
    expect(materialHsnCodeSchema.parse(null)).toBeNull();
    expect(materialHsnCodeSchema.parse(undefined)).toBeUndefined();
  });

  it('is the rule on material create and update', () => {
    const base = {
      code: 'MAT-1',
      name: 'Test material',
      categoryId: '5b0e7a53-7d0f-4c8e-9a53-2d1f3b0c9e11',
      unit: 'METER',
    };
    expect(createMaterialSchema.safeParse({ ...base, hsnCode: '5208' }).success).toBe(false);
    expect(createMaterialSchema.safeParse({ ...base, hsnCode: '520812' }).success).toBe(true);
    expect(createMaterialSchema.safeParse({ ...base, hsnCode: '' }).data?.hsnCode).toBeNull();
    expect(createMaterialSchema.safeParse(base).data?.hsnCode).toBeUndefined();
    expect(updateMaterialSchema.safeParse({ hsnCode: '5208' }).success).toBe(false);
    expect(updateMaterialSchema.safeParse({ hsnCode: '52081210' }).success).toBe(true);
  });

  it('is the rule on every PO line body', () => {
    const line = { materialId: 'mat-1', orderedQuantity: 10, unit: 'METER', unitPrice: 50 };
    for (const schema of [purchaseOrderItemSchema, addPurchaseOrderItemSchema]) {
      expect(schema.safeParse({ ...line, hsnCode: '5208' }).success).toBe(false);
      expect(schema.safeParse({ ...line, hsnCode: '520812' }).success).toBe(true);
      expect(schema.safeParse({ ...line, hsnCode: '' }).data?.hsnCode).toBeNull();
    }
    expect(updatePurchaseOrderItemSchema.safeParse({ hsnCode: '5208' }).success).toBe(false);
    // null / blank on an edit = back to the material's own HSN
    expect(updatePurchaseOrderItemSchema.safeParse({ hsnCode: '' }).data?.hsnCode).toBeNull();
  });

  it('is the same pattern on the Material form', () => {
    const src = fs.readFileSync(MATERIAL_FORM, 'utf8');
    const match = src.match(/const MATERIAL_HSN_PATTERN = (\/.+\/);/);
    expect(match?.[1]).toBe(String(MATERIAL_HSN_PATTERN));
  });
});
