/**
 * What the CAD table's row save posts must survive the schema (PUT /cad-planning/:styleId/row/:rowId).
 * Until 2026-10-01 the sizes popup's Clear (piecesPerMarker 0) was refused with "Invalid request data", and the
 * sizeId of every size line was stripped, so it was stored as null.
 */
import { updateCADTableRowSchema } from '../../schemas/cadPlanning.schema';

describe('updateCADTableRowSchema', () => {
  it('accepts a cleared size breakdown (0 pieces, no sizes)', () => {
    const parsed = updateCADTableRowSchema.safeParse({ sizeBreakdowns: [], piecesPerMarker: 0 });
    expect(parsed.success).toBe(true);
  });

  it("keeps each size line's sizeId", () => {
    const parsed = updateCADTableRowSchema.parse({
      sizeBreakdowns: [{ sizeName: 'S', sizeId: 'size-1', quantity: 1 }],
      piecesPerMarker: 1,
    });
    expect(parsed.sizeBreakdowns?.[0]).toEqual({ sizeName: 'S', sizeId: 'size-1', quantity: 1 });
  });

  it('still refuses a negative piece count', () => {
    expect(updateCADTableRowSchema.safeParse({ piecesPerMarker: -1 }).success).toBe(false);
  });
});
