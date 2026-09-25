/**
 * The one size-order rule (utils/sku-generator.ts): sizes read XS → XXXL on every screen and in
 * every stored sortOrder, never alphabetically (L, M, S, XL, XS…).
 */
import fs from 'fs';
import path from 'path';
import { SIZE_ORDER, compareSizes, getSizeOrder } from '../../utils/sku-generator';

describe('getSizeOrder / compareSizes', () => {
  it('reads letter sizes smallest to largest, not alphabetically', () => {
    const shuffled = ['XXL', 'L', 'XS', 'XXXL', 'M', 'S', 'XL', '4XL', 'XXS', '5XL'];
    expect([...shuffled].sort(compareSizes)).toEqual(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL']);
  });

  it('treats 2XL / 3XL as XXL / XXXL and ignores case and surrounding spaces', () => {
    expect(getSizeOrder('2XL')).toBe(getSizeOrder('XXL'));
    expect(getSizeOrder('3xl')).toBe(getSizeOrder('XXXL'));
    expect(getSizeOrder(' m ')).toBe(SIZE_ORDER.M);
  });

  it('sorts plain numbers numerically and kids sizes by age', () => {
    expect(['32', '28', '100', '30'].sort(compareSizes)).toEqual(['28', '30', '32', '100']);
    expect(['12Y', '2Y', '8Y'].sort(compareSizes)).toEqual(['2Y', '8Y', '12Y']);
  });

  it('puts unknown sizes after every known one, alphabetically among themselves', () => {
    expect(['Petite', 'XL', 'Curvy', 'Free Size'].sort(compareSizes)).toEqual(['XL', 'Free Size', 'Curvy', 'Petite']);
  });
});

describe('frontend twin', () => {
  it('carries a byte-identical size-order block', () => {
    const block = (file: string) => {
      const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      const start = src.indexOf('// ── Size order: BEGIN');
      const end = src.indexOf('// ── Size order: END ──');
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      return src.slice(start, end);
    };
    const backend = path.resolve(__dirname, '../../utils/sku-generator.ts');
    const frontend = path.resolve(__dirname, '../../../../frontend/src/utils/sku-generator.ts');
    expect(block(frontend)).toBe(block(backend));
  });
});
