/**
 * Weavers — the mill that wove a greige or fabric we bought (Phase 1b, 2026-09-25).
 *
 * The weaver we buy a greige from keeps changing, so it lives on the purchase (PO line, GRN line)
 * and the stock lot, never on the greige master. This list only keeps spellings consistent so
 * "which weaver" reports group: the same name in any case or spacing is ONE weaver (nameKey).
 */
import prisma from '../config/database';
import { buildSearchWhere } from '../utils/search-filter';
import type { CreateWeaverInput, WeaverQuery } from '../schemas/weaver.schema';

/** "  Kalai   MANGAL " → "kalai mangal" — the uniqueness key. */
export function weaverNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Display form: single spaces, as typed otherwise. */
function tidyName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

const WEAVER_SELECT = { id: true, name: true, city: true, supplierId: true } as const;

export const weaverService = {
  async search(query: WeaverQuery) {
    return prisma.weavers.findMany({
      where: { isActive: true, ...(buildSearchWhere(query.search, ['name', 'city']) ?? {}) },
      select: WEAVER_SELECT,
      orderBy: { name: 'asc' },
      take: query.limit ?? 50,
    });
  },

  /** Add on the spot — or hand back the weaver that already has this name. Never a duplicate. */
  async findOrCreate(input: CreateWeaverInput, userId: string) {
    const nameKey = weaverNameKey(input.name);
    const existing = await prisma.weavers.findUnique({ where: { nameKey }, select: WEAVER_SELECT });
    if (existing) return { weaver: existing, created: false };
    try {
      const weaver = await prisma.weavers.create({
        data: {
          name: tidyName(input.name),
          nameKey,
          city: input.city?.trim() || null,
          supplierId: input.supplierId ?? null,
          createdById: userId,
        },
        select: WEAVER_SELECT,
      });
      return { weaver, created: true };
    } catch (err) {
      // Two people adding the same new weaver at once: the unique nameKey lets one win; hand the
      // other the winner instead of an error.
      const raced = await prisma.weavers.findUnique({ where: { nameKey }, select: WEAVER_SELECT });
      if (raced) return { weaver: raced, created: false };
      throw err;
    }
  },
};
