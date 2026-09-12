import { buildSearchWhere, applySearch } from '../../utils/search-filter';

const like = (term: string) => ({ contains: term, mode: 'insensitive' });

describe('buildSearchWhere', () => {
  it('returns undefined when there is nothing to search for', () => {
    expect(buildSearchWhere(undefined, ['a'])).toBeUndefined();
    expect(buildSearchWhere(null, ['a'])).toBeUndefined();
    expect(buildSearchWhere('', ['a'])).toBeUndefined();
    expect(buildSearchWhere('   ', ['a'])).toBeUndefined();
    expect(buildSearchWhere('anything', [])).toBeUndefined();
  });

  it('matches a single term against every field', () => {
    expect(buildSearchWhere('LNG182G', ['orderNumber', 'styleName'])).toEqual({
      AND: [{ OR: [{ orderNumber: like('LNG182G') }, { styleName: like('LNG182G') }] }],
    });
  });

  it('requires EVERY word to match, though they may match different fields', () => {
    // The whole point: "kasya LNG182G" is a customer AND a style. Matching the phrase against
    // each field (the old behaviour) found nothing.
    const result = buildSearchWhere('kasya LNG182G', ['customer.name', 'styleCode']);

    expect(result).toEqual({
      AND: [
        { OR: [{ customer: { name: like('kasya') } }, { styleCode: like('kasya') }] },
        { OR: [{ customer: { name: like('LNG182G') } }, { styleCode: like('LNG182G') }] },
      ],
    });
  });

  it('collapses runs of whitespace between words', () => {
    const spaced = buildSearchWhere('  house    kasya ', ['name']);
    expect(spaced?.AND).toHaveLength(2);
    expect(spaced).toEqual(buildSearchWhere('house kasya', ['name']));
  });

  it('nests a dotted path one relation deep', () => {
    expect(buildSearchWhere('acme', ['customers.name'])).toEqual({
      AND: [{ OR: [{ customers: { name: like('acme') } }] }],
    });
  });

  it('nests a dotted path several relations deep', () => {
    expect(buildSearchWhere('x', ['workOrder.order.customers.name'])).toEqual({
      AND: [{ OR: [{ workOrder: { order: { customers: { name: like('x') } } } }] }],
    });
  });

  it('uses `some` for a to-many hop marked with []', () => {
    expect(buildSearchWhere('LNG182G', ['items[].style.styleCode'])).toEqual({
      AND: [{ OR: [{ items: { some: { style: { styleCode: like('LNG182G') } } } }] }],
    });
  });

  it('handles a to-many hop that is not the first segment', () => {
    expect(buildSearchWhere('x', ['order.items[].styleCode'])).toEqual({
      AND: [{ OR: [{ order: { items: { some: { styleCode: like('x') } } } }] }],
    });
  });
});

describe('applySearch', () => {
  it('leaves the where object untouched when there is no search term', () => {
    const where: Record<string, unknown> = { status: 'DRAFT' };
    applySearch(where, '', ['name']);
    expect(where).toEqual({ status: 'DRAFT' });
  });

  it('adds the search under AND so sibling filters still narrow the result', () => {
    // Assigning to `where.OR` (what the old hand-rolled searches did) would have let a search
    // match rows the status filter was meant to exclude.
    const where: Record<string, unknown> = { status: 'DRAFT' };
    applySearch(where, 'acme', ['name']);

    expect(where.status).toBe('DRAFT');
    expect(where.AND).toEqual([{ OR: [{ name: like('acme') }] }]);
  });

  it('appends to an existing AND array rather than replacing it', () => {
    const where: Record<string, unknown> = { AND: [{ isActive: true }] };
    applySearch(where, 'acme', ['name']);

    expect(where.AND).toEqual([{ isActive: true }, { OR: [{ name: like('acme') }] }]);
  });

  it('promotes a single existing AND object into an array', () => {
    const where: Record<string, unknown> = { AND: { isActive: true } };
    applySearch(where, 'acme', ['name']);

    expect(where.AND).toEqual([{ isActive: true }, { OR: [{ name: like('acme') }] }]);
  });

  it('adds one AND clause per word', () => {
    const where: Record<string, unknown> = {};
    applySearch(where, 'red LNG182G', ['styleCode', 'colour.name']);
    expect(where.AND).toHaveLength(2);
  });
});
