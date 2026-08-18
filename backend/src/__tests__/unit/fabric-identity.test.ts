/**
 * Fabric Identity Helper Unit Tests — the naming convention as a pure function.
 *
 * Convention (user decision 2026-08-18, FabricForm order):
 *   <styleCode (buyerRef)> - <greigeGeneric> - <finishLabel> - <Part> - <Colour> - <Width"> - <Embroidery>
 */

import {
  buildFinishedFabricName,
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
