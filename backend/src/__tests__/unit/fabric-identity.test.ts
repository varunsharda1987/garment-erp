/**
 * Fabric Identity Helper Unit Tests — the naming convention as a pure function.
 *
 * Convention (user decision 2026-08-18, FabricForm order):
 *   <styleCode (buyerRef)> - <greigeGeneric> - <finishLabel> - <Part> - <Colour> - <Width"> - <Embroidery>
 */

import {
  buildFinishedFabricName,
  resolveIdentityColourName,
  resolvePartFromCadShape,
  FINISH_LABELS,
  FinishedFabricIdentity,
} from '../../services/helpers/fabric-identity.helper';

function identity(overrides: Partial<FinishedFabricIdentity> = {}): FinishedFabricIdentity {
  return {
    greigeId: 'g1',
    greige: {
      greigeName: 'Viscose Moss 1×1 / 1×1 / 63" (Super Dyeing)',
      genericGreigeName: 'Viscose Moss',
      composition: '100% Viscose',
      yarnCount: '1×1',
    },
    styleId: 's1',
    styleCode: 'ESSKY086LS',
    buyerStyleRef: null,
    finishType: 'DYED',
    colorName: 'Beige',
    colorCode: null,
    colorMasterId: null,
    printDesign: null,
    styleFabricId: 'sf1',
    patternPartId: 'pp1',
    patternPartName: 'All Parts',
    hasEmbroidery: false,
    embroideryCode: null,
    nameWidthInches: 54,
    ...overrides,
  };
}

describe('buildFinishedFabricName', () => {
  it('builds the full live-example name (DJ-ESSKY086LS-003)', () => {
    expect(buildFinishedFabricName(identity())).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - All Parts - Beige - 54"'
    );
  });

  it('appends the buyer ref via formatStyleCodeWithRef (ref sanitized)', () => {
    expect(buildFinishedFabricName(identity({ buyerStyleRef: 'ZR - 4087' }))).toBe(
      'ESSKY086LS (ZR-4087) - Viscose Moss - Solid/Dyed - All Parts - Beige - 54"'
    );
  });

  it('omits the style segment for STK (no-style) fabrics', () => {
    expect(buildFinishedFabricName(identity({ styleCode: null, styleId: null }))).toBe(
      'Viscose Moss - Solid/Dyed - All Parts - Beige - 54"'
    );
  });

  it('omits colour when unknown (never a Natural/Unknown placeholder)', () => {
    expect(buildFinishedFabricName(identity({ colorName: null }))).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - All Parts - 54"'
    );
  });

  it('omits width when neither measured nor asked width is known', () => {
    expect(buildFinishedFabricName(identity({ nameWidthInches: null }))).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - All Parts - Beige'
    );
  });

  it('omits the part segment when unresolvable', () => {
    expect(buildFinishedFabricName(identity({ patternPartId: null, patternPartName: null }))).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - Beige - 54"'
    );
  });

  it('printed fabrics show the design in the colour slot', () => {
    expect(
      buildFinishedFabricName(identity({ finishType: 'PRINTED', printDesign: 'Floral AOP', colorName: 'White' }))
    ).toBe('ESSKY086LS - Viscose Moss - Printed - All Parts - Floral AOP - 54"');
  });

  it('printed fabrics fall back to the ground colour when no design', () => {
    expect(buildFinishedFabricName(identity({ finishType: 'PRINTED', printDesign: null, colorName: 'White' }))).toBe(
      'ESSKY086LS - Viscose Moss - Printed - All Parts - White - 54"'
    );
  });

  it('appends the embroidery code (or the Embroidery literal) last', () => {
    expect(buildFinishedFabricName(identity({ hasEmbroidery: true, embroideryCode: 'EMB-012' }))).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - All Parts - Beige - 54" - EMB-012'
    );
    expect(buildFinishedFabricName(identity({ hasEmbroidery: true, embroideryCode: null }))).toBe(
      'ESSKY086LS - Viscose Moss - Solid/Dyed - All Parts - Beige - 54" - Embroidery'
    );
  });

  it('derives the generic greige from greigeName when genericGreigeName is absent', () => {
    expect(
      buildFinishedFabricName(
        identity({
          greige: {
            greigeName: 'Poplin 40×40 / 88×66 / 63" (Printing)',
            genericGreigeName: null,
            composition: null,
            yarnCount: null,
          },
        })
      )
    ).toBe('ESSKY086LS - Poplin 40×40 - Solid/Dyed - All Parts - Beige - 54"');
  });

  it('keeps fractional widths as typed (55.5")', () => {
    expect(buildFinishedFabricName(identity({ nameWidthInches: 55.5 }))).toContain('55.5"');
  });
});

describe('FINISH_LABELS', () => {
  it('mirrors the frontend fabric-finish-types labels', () => {
    expect(FINISH_LABELS.DYED).toBe('Solid/Dyed');
    expect(FINISH_LABELS.PRINTED).toBe('Printed');
    expect(FINISH_LABELS.YARN_DYED).toBe('Yarn Dyed');
    expect(FINISH_LABELS.RAW).toBe('Raw/Unfinished');
  });
});

/**
 * The colour ladder decides the finished-fabric dedup tuple, so its ORDER is commercial, not
 * cosmetic: whichever rung answers determines whether two runs become one fabric master or two.
 * The stock rungs were added for style-less jobs (2026-08-19) and must never outrank the chain.
 */
describe('resolveIdentityColourName', () => {
  const stockJwo = { colorMaster: { id: 'c1', colorName: 'Black', colorCode: 'BLK' }, colorName: 'Ignored Free Text' };

  it('takes the requirement colour ahead of everything below it', () => {
    expect(
      resolveIdentityColourName({
        requirement: { colorName: 'Beige' },
        orderBomItem: { colorName: 'Navy' },
        jwo: { ...stockJwo, labDip: { targetColor: { colorName: 'Rust' } } },
        finishType: 'DYED',
      })
    ).toBe('Beige');
  });

  it('falls to the BOM item, then the lab dip, before any job-work rung', () => {
    expect(
      resolveIdentityColourName({
        orderBomItem: { colorName: 'Navy' },
        jwo: { ...stockJwo, labDip: { targetColor: { colorName: 'Rust' } } },
        finishType: 'DYED',
      })
    ).toBe('Navy');
    expect(
      resolveIdentityColourName({
        jwo: { ...stockJwo, labDip: { targetColor: { colorName: 'Rust' } } },
        finishType: 'DYED',
      })
    ).toBe('Rust');
  });

  it("uses the dye house's shade reference on a DYED job but never on a PRINTED one", () => {
    const jwo = { labDip: { colorReference: 'Pantone 19-4052' } };
    expect(resolveIdentityColourName({ jwo, finishType: 'DYED' })).toBe('Pantone 19-4052');
    expect(resolveIdentityColourName({ jwo, finishType: 'PRINTED' })).toBeNull();
  });

  it('reaches the stock colour master only when the whole order chain is empty', () => {
    expect(resolveIdentityColourName({ jwo: stockJwo, finishType: 'DYED' })).toBe('Black');
    // ...and a PRINTED stock job still gets one, since the colorReference rung is skipped, not fatal
    expect(resolveIdentityColourName({ jwo: stockJwo, finishType: 'PRINTED' })).toBe('Black');
  });

  it('accepts free-text colour as the last resort (import/API callers with no master row)', () => {
    expect(resolveIdentityColourName({ jwo: { colorName: 'Buyer Ecru' }, finishType: 'DYED' })).toBe('Buyer Ecru');
  });

  it('treats blank and whitespace-only values as absent rather than as a colour', () => {
    expect(
      resolveIdentityColourName({
        requirement: { colorName: '   ' },
        orderBomItem: { colorName: '' },
        jwo: stockJwo,
        finishType: 'DYED',
      })
    ).toBe('Black');
  });

  it('returns null for a job with no colour anywhere — the pre-2026-08-19 stock behaviour', () => {
    expect(resolveIdentityColourName({ jwo: {}, finishType: 'DYED' })).toBeNull();
    expect(resolveIdentityColourName({ finishType: 'DYED' })).toBeNull();
  });
});

describe('resolvePartFromCadShape', () => {
  it('prefers the CAD row single pattern part', () => {
    expect(
      resolvePartFromCadShape({
        patternPart: { id: 'p1', name: 'Yoke' },
        cadPatternParts: [{ patternPart: { id: 'p2', name: 'Body', sortOrder: 1 } }],
      })
    ).toEqual({ id: 'p1', name: 'Yoke' });
  });

  it('takes the FIRST multi-part by sortOrder, then name', () => {
    expect(
      resolvePartFromCadShape({
        cadPatternParts: [
          { patternPart: { id: 'p3', name: 'Sleeve', sortOrder: 5 } },
          { patternPart: { id: 'p2', name: 'Collar', sortOrder: 2 } },
          { patternPart: { id: 'p4', name: 'Body', sortOrder: 2 } },
        ],
      })
    ).toEqual({ id: 'p4', name: 'Body' });
  });

  it('returns null when the CAD row carries no part (ladder falls to style_pattern_parts)', () => {
    expect(resolvePartFromCadShape({ styleFabricId: 'sf1' })).toBeNull();
    expect(resolvePartFromCadShape(null)).toBeNull();
  });
});
