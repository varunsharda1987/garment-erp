/**
 * buildSearchWhere: dimension spellings and LIKE escaping (Purchase Orders audit, 2026-09-26).
 *
 * - "30x30" found 0 of the 7 POs for a 30×30 greige: masters are typed "30×30", "68X64", "30*30".
 * - `search=%` returned all 13 POs and "PO2609_000" found 7: Prisma's `contains` sends `ILIKE $1`
 *   with `$1 = '%' + term + '%'`, escaping none of `%`, `_` or `\`.
 */
import { buildSearchWhere } from '../../utils/search-filter';

const like = (term: string) => ({ contains: term, mode: 'insensitive' });
const BS = '\\'; // one backslash, spelled out so the expectations read unambiguously

describe('buildSearchWhere — dimension spellings', () => {
  const allFour = ['30x30', '30X30', '30×30', '30*30'];

  it('expands "30x30" into all four spellings, ORed within the one word', () => {
    expect(buildSearchWhere('30x30', ['greigeName'])).toEqual({
      AND: [{ OR: allFour.map((s) => ({ greigeName: like(s) })) }],
    });
  });

  it.each(['30X30', '30×30', '30*30'])('expands "%s" into the same four spellings', (typed) => {
    expect(buildSearchWhere(typed, ['greigeName'])).toEqual(buildSearchWhere('30x30', ['greigeName']));
  });

  it('crosses every spelling with every field, keeping nested paths', () => {
    const result = buildSearchWhere('68X64', ['poNumber', 'items[].materials.name']);
    const or = result?.AND[0].OR as unknown[];

    expect(or).toHaveLength(8);
    expect(or).toContainEqual({ poNumber: like('68×64') });
    expect(or).toContainEqual({ items: { some: { materials: { name: like('68x64') } } } });
    expect(or).toContainEqual({ items: { some: { materials: { name: like('68*64') } } } });
  });

  it('swaps every separator in a word the same way ("30x30x2")', () => {
    const or = buildSearchWhere('30x30x2', ['name'])?.AND[0].OR;
    expect(or).toEqual(['30x30x2', '30X30X2', '30×30×2', '30*30*2'].map((s) => ({ name: like(s) })));
  });

  it('keeps AND across words: "Poplin 40x40" is Poplin AND any spelling of 40x40', () => {
    expect(buildSearchWhere('Poplin 40x40', ['greigeName', 'greigeCode'])).toEqual({
      AND: [
        { OR: [{ greigeName: like('Poplin') }, { greigeCode: like('Poplin') }] },
        {
          OR: ['40x40', '40X40', '40×40', '40*40'].flatMap((s) => [{ greigeName: like(s) }, { greigeCode: like(s) }]),
        },
      ],
    });
  });

  it.each(['x', 'XL', 'box', '2x', 'x2', 'L-XL', 'Size X', '3 x 3'])(
    'leaves "%s" alone — no digit on both sides of the separator',
    (typed) => {
      const words = typed.split(' ');
      expect(buildSearchWhere(typed, ['name'])).toEqual({
        AND: words.map((w) => ({ OR: [{ name: like(w) }] })),
      });
    }
  );
});

describe('buildSearchWhere — LIKE wildcards match themselves', () => {
  it('escapes % so it no longer matches every row', () => {
    expect(buildSearchWhere('%', ['poNumber'])).toEqual({ AND: [{ OR: [{ poNumber: like(`${BS}%`) }] }] });
  });

  it('escapes _ so it no longer matches any single character', () => {
    expect(buildSearchWhere('_', ['poNumber'])).toEqual({ AND: [{ OR: [{ poNumber: like(`${BS}_`) }] }] });
    expect(buildSearchWhere('PO2609_000', ['poNumber'])).toEqual({
      AND: [{ OR: [{ poNumber: like(`PO2609${BS}_000`) }] }],
    });
  });

  it('escapes the escape character itself', () => {
    expect(buildSearchWhere(`a${BS}b`, ['name'])).toEqual({ AND: [{ OR: [{ name: like(`a${BS}${BS}b`) }] }] });
    expect(buildSearchWhere(BS, ['name'])).toEqual({ AND: [{ OR: [{ name: like(`${BS}${BS}`) }] }] });
  });

  it('escapes every spelling of a dimension that also carries a wildcard', () => {
    const or = buildSearchWhere('30x30%', ['name'])?.AND[0].OR;
    expect(or).toEqual(['30x30', '30X30', '30×30', '30*30'].map((s) => ({ name: like(`${s}${BS}%`) })));
  });

  it('leaves ordinary words, codes and hyphens exactly as typed', () => {
    expect(buildSearchWhere('Super Dyeing PO2609-0008', ['name'])).toEqual({
      AND: ['Super', 'Dyeing', 'PO2609-0008'].map((w) => ({ OR: [{ name: like(w) }] })),
    });
  });
});
