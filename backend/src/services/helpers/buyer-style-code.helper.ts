/**
 * A Buyer Style Code belongs to ONE active style — the rule the Style form (create + edit) and the
 * style import share. The buyer's code is the main name of a style on every screen and printout
 * (CLAUDE.md → "Style identity"), so two active styles answering to one code would print the same
 * name on two different garments.
 *
 * Exact match on the trimmed code, among active styles, any customer — the rule the Style form has
 * always applied.
 */

import prisma from '../../config/database';

type StylesClient = { styles: Pick<typeof prisma.styles, 'findFirst'> };

/** The active style that already carries this Buyer Style Code (other than `excludeStyleId`), or null. */
export async function buyerStyleCodeOwner(
  buyerStyleRef: string | null | undefined,
  excludeStyleId?: string | null,
  client: StylesClient = prisma
): Promise<{ id: string; styleCode: string } | null> {
  const code = buyerStyleRef?.trim();
  if (!code) return null;
  return client.styles.findFirst({
    where: {
      buyerStyleRef: code,
      isActive: true,
      ...(excludeStyleId ? { id: { not: excludeStyleId } } : {}),
    },
    select: { id: true, styleCode: true },
  });
}

/** The one wording for a taken Buyer Style Code. */
export function buyerStyleCodeTakenMessage(buyerStyleRef: string, owner: { styleCode: string }): string {
  return `Buyer Style Code "${buyerStyleRef.trim()}" already exists on style ${owner.styleCode}`;
}
