/**
 * The lace name rule carries the design (2026-09-27) — before, a regenerated name dropped it and
 * "White Scallop …" read "LACE-0004 | Poly Lace | …".
 */
import { generateLaceName, isGeneratedLaceName, laceDesignSegment } from '../../services/helpers/lace-name.helper';

describe('lace name rule', () => {
  it('puts the design after the type', async () => {
    await expect(
      generateLaceName({
        laceCode: 'LACE-0004',
        laceType: 'Poly Lace',
        design: 'Scallop',
        composition: '100% Polyster',
        width: 0.25,
        color: 'White',
        isGreige: false,
      })
    ).resolves.toBe('LACE-0004 | Poly Lace | Scallop | 100% Polyster | 0.25" | White');
  });

  it('greige lace keeps its design and ends GREIGE', async () => {
    await expect(
      generateLaceName({
        laceCode: 'LACE-0011',
        laceType: 'Cotton Lace',
        design: 'Kingri',
        composition: '100% Cotton',
        width: 0.25,
        color: 'Red',
        isGreige: true,
      })
    ).resolves.toBe('LACE-0011 | Cotton Lace | Kingri | 100% Cotton | 0.25" | GREIGE');
  });

  it('a dyed variant without a style says where it came from, never "→ ?"', async () => {
    await expect(
      generateLaceName({
        laceCode: 'LACE-0010',
        laceType: 'Schiffli',
        design: null,
        composition: '100% Cotton',
        width: 1,
        color: 'Red',
        isGreige: false,
        sourceGreigeLaceCode: 'LACE-0009',
      })
    ).resolves.toBe('LACE-0010 | Schiffli | 100% Cotton | 1" | Red | from LACE-0009');
  });

  it('no design, no segment; blank parts fall back as before', async () => {
    await expect(generateLaceName({ laceCode: 'LACE-0016', isGreige: false })).resolves.toBe(
      'LACE-0016 | Lace | Unspecified'
    );
  });

  it('trims stray spaces from typed parts', async () => {
    await expect(
      generateLaceName({
        laceCode: 'LACE-0018',
        laceType: 'Silver frinze lace',
        design: ' Fringe ',
        composition: ' frinze  lace',
        width: 1,
        color: 'Silver ',
        isGreige: false,
      })
    ).resolves.toBe('LACE-0018 | Silver frinze lace | Fringe | frinze lace | 1" | Silver');
  });

  it('does not repeat a design the type already says', () => {
    expect(laceDesignSegment(' flower', 'Big flower lace')).toBeNull();
    expect(laceDesignSegment('ladder lace', 'ladder lace')).toBeNull();
    expect(laceDesignSegment('Scallop', 'Poly Lace')).toBe('Scallop');
    expect(laceDesignSegment('   ', 'Poly Lace')).toBeNull();
  });

  it('tells a generated name from a typed one', () => {
    expect(isGeneratedLaceName('LACE-0004', 'LACE-0004 | Poly Lace | White')).toBe(true);
    expect(isGeneratedLaceName('LACE-0034', 'LACE-0034 Golden Zari Loop Lace')).toBe(false);
    expect(isGeneratedLaceName('LACE-0040', 'Golden Samosa Gota Patti Lace')).toBe(false);
  });
});
