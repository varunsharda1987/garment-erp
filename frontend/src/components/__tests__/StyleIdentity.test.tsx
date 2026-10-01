/**
 * A style is named by its Buyer Style Code first (owner, 2026-09-29); our Style Code follows,
 * muted, only when it differs.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StyleIdentity } from '@/components/StyleIdentity';

const EBWW = { styleCode: 'EBWW-021', buyerStyleRef: 'SP27DR27' };

describe('StyleIdentity', () => {
  it('inline: buyer style code, then our code and the name', () => {
    const { container } = render(<StyleIdentity style={EBWW} name="GEMINI" />);
    expect(container.textContent).toBe('SP27DR27 (EBWW-021) — GEMINI');
    expect(container.querySelector('.font-medium')?.textContent).toBe('SP27DR27');
  });

  it('stacked: buyer style code over the name, our code left to its own column', () => {
    const { container } = render(<StyleIdentity style={EBWW} name="GEMINI" layout="stacked" showStyleCode={false} />);
    expect(container.textContent).toBe('SP27DR27GEMINI');
  });

  it('prints one code when there is no separate buyer code', () => {
    const { container } = render(<StyleIdentity style={{ styleCode: 'LNG276', buyerStyleRef: null }} />);
    expect(container.textContent).toBe('LNG276');
  });

  it("uses the sale-order line's snapshot", () => {
    const { container } = render(
      <StyleIdentity style={{ styleCode: 'EBWW-018', buyerStyleRef: 'SP27ABW005B' }} lineRef="SP27ABW005A" />
    );
    expect(container.textContent).toBe('SP27ABW005A (EBWW-018)');
  });

  it('shows the garment photo only when asked', () => {
    const plain = render(<StyleIdentity style={EBWW} imageUrl="/uploads/styles/a.jpg" />);
    expect(plain.container.querySelector('img')).toBeNull();

    const { container } = render(
      <StyleIdentity style={EBWW} name="GEMINI" layout="stacked" showStyleCode={false} imageUrl="/uploads/styles/a.jpg" showImage />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/\/uploads\/styles\/a\.jpg\?thumb=1$/);
    expect(img?.getAttribute('alt')).toBe('SP27DR27 — GEMINI');
    expect(container.textContent).toContain('SP27DR27GEMINI');
  });

  it('shows a placeholder, not a broken image, when the style has no photo', () => {
    const { container } = render(<StyleIdentity style={EBWW} showImage />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[aria-label="No garment photo"]')).not.toBeNull();
  });
});
