/**
 * The one style-identity rule (utils/style-code.ts). Owner, 2026-09-29: the buyer's style code is
 * the most important — every screen and printout names a style by it first, ours second.
 */

import fs from 'fs';
import path from 'path';
import {
  BUYER_STYLE_CODE_LABEL,
  STYLE_CODE_LABEL,
  buyerStyleCode,
  formatStyleCodeWithRef,
  lineBuyerStyleRef,
  ourStyleCode,
  skuStyleCode,
  styleCodeIfDifferent,
  styleCodeLabel,
} from '../../utils/style-code';

const EBWW = { styleCode: 'EBWW-021', buyerStyleRef: 'SP27DR27' };
const ESSKY = { styleCode: 'ESSKY082LS', buyerStyleRef: 'ESSKY082LS' };
const KASYA = { styleCode: 'LNG276', buyerStyleRef: null };

describe('style identity — Buyer Style Code first', () => {
  it('names the two codes one way', () => {
    expect(BUYER_STYLE_CODE_LABEL).toBe('Buyer Style Code');
    expect(STYLE_CODE_LABEL).toBe('Style Code');
  });

  it('leads with the buyer style code, our code in brackets', () => {
    expect(buyerStyleCode(EBWW)).toBe('SP27DR27');
    expect(ourStyleCode(EBWW)).toBe('EBWW-021');
    expect(styleCodeIfDifferent(EBWW)).toBe('EBWW-021');
    expect(styleCodeLabel(EBWW)).toBe('SP27DR27 (EBWW-021)');
  });

  it('never repeats a code that is the same (any case)', () => {
    expect(styleCodeLabel(ESSKY)).toBe('ESSKY082LS');
    expect(styleCodeIfDifferent(ESSKY)).toBeNull();
    expect(styleCodeLabel({ styleCode: 'ESSKY082LS', buyerStyleRef: 'essky082ls ' })).toBe('essky082ls');
  });

  it('falls back to our code when the style has no buyer code (in-house brands)', () => {
    expect(buyerStyleCode(KASYA)).toBe('LNG276');
    expect(styleCodeLabel(KASYA)).toBe('LNG276');
    expect(styleCodeIfDifferent(KASYA)).toBeNull();
    expect(buyerStyleCode({ styleCode: 'LNG276', buyerStyleRef: '   ' })).toBe('LNG276');
  });

  it("lets the sale-order line's snapshot win over the style's current code", () => {
    const recoded = { styleCode: 'EBWW-018', buyerStyleRef: 'SP27ABW005B' };
    expect(buyerStyleCode(recoded, 'SP27ABW005A')).toBe('SP27ABW005A');
    expect(styleCodeLabel(recoded, 'SP27ABW005A')).toBe('SP27ABW005A (EBWW-018)');
    expect(styleCodeLabel(recoded, null)).toBe('SP27ABW005B (EBWW-018)');
    expect(styleCodeLabel(recoded, '')).toBe('SP27ABW005B (EBWW-018)');
    expect(lineBuyerStyleRef('SP27ABW005A', 'SP27ABW005B')).toBe('SP27ABW005A');
    expect(lineBuyerStyleRef(null, 'SP27ABW005B')).toBe('SP27ABW005B');
    expect(lineBuyerStyleRef(' ', null)).toBeNull();
  });

  it('uses the fallback only when the style carries neither code', () => {
    expect(buyerStyleCode(null)).toBe('—');
    expect(styleCodeLabel(undefined, null, 'No style')).toBe('No style');
    expect(ourStyleCode({ buyerStyleRef: 'SP27DR27' })).toBe('—');
    expect(styleCodeLabel({ buyerStyleRef: 'SP27DR27' })).toBe('SP27DR27');
  });

  it('keeps a label one segment of a " - " joined fabric name', () => {
    const label = styleCodeLabel({ styleCode: 'ST-001', buyerStyleRef: 'ZR 4087 - 042' });
    expect(label).toBe('ZR 4087-042 (ST-001)');
    expect(`${label} - Rayon - Dyed - Navy`.split(' - ')).toHaveLength(4);
  });

  it('keeps the legacy code-first shape for text saved in it (invoice description)', () => {
    expect(formatStyleCodeWithRef('EBWW-021', 'SP27DR27')).toBe('EBWW-021 (SP27DR27)');
    expect(formatStyleCodeWithRef('ST-001', 'ZR 4087 - 042')).toBe('ST-001 (ZR 4087-042)');
    expect(formatStyleCodeWithRef('LNG276', null)).toBe('LNG276');
  });

  it("starts a new SKU with the buyer's code, else ours (owner, 2026-10-01)", () => {
    expect(skuStyleCode(EBWW)).toBe('SP27DR27');
    expect(skuStyleCode(ESSKY)).toBe('ESSKY082LS');
    expect(skuStyleCode(KASYA)).toBe('LNG276');
    expect(skuStyleCode({ styleCode: 'EBWW-021', buyerStyleRef: '   ' })).toBe('EBWW-021');
    expect(skuStyleCode({ styleCode: '', buyerStyleRef: null })).toBe('STYLE');
    expect(skuStyleCode(null)).toBe('STYLE');
  });

  it('is identical to its frontend twin', () => {
    const read = (file: string) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const backend = path.resolve(__dirname, '../../utils/style-code.ts');
    const frontend = path.resolve(__dirname, '../../../../frontend/src/lib/style-code.ts');
    expect(read(frontend)).toBe(read(backend));
  });
});
