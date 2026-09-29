/**
 * Lace name — ONE rule for every writer (create, dyed variant, edit, and the regenerate script).
 *
 * - GREIGE:    {laceCode} | {laceType} | {design} | {composition} | {width}" | GREIGE
 * - READY:     {laceCode} | {laceType} | {design} | {composition} | {width}" | {color}
 * - PROCESSED: {laceCode} | {laceType} | {design} | {composition} | {width}" | {color} | {sourceGreigeCode} → {style}
 *   where {style} is the Buyer Style Code first, our code in brackets when it differs ('SP27DR27 (EBWW-021)',
 *   styleCodeLabel) — since 2026-09-29; names saved before read '→ EBWW-021 (SP27DR27)' and are not renamed.
 *
 * The design ("Scallop", "Triangle", "Kingri") is what people call a lace by. It was left out until
 * 2026-09-27 although the form promised a name "from color, design, composition", so a regenerated name
 * dropped it ("White Scallop …" became "LACE-0004 | Poly Lace | …"). A design already inside the type
 * ("flower" in "Big flower lace") is not repeated.
 */
import prisma from '../../config/database';
import { styleCodeLabel } from '../../utils/style-code';

export interface LaceNameInput {
  laceCode: string;
  laceType?: string | null;
  design?: string | null;
  composition?: string | null;
  width?: number | null;
  color?: string | null;
  isGreige: boolean;
  sourceGreigeLaceCode?: string | null;
  processedForStyleCode?: string | null;
}

/** The design segment, or null when it is blank or already said by the type */
export function laceDesignSegment(design?: string | null, laceType?: string | null): string | null {
  const d = clean(design);
  if (!d) return null;
  const type = (clean(laceType) ?? '').toLowerCase();
  if (type && type.includes(d.toLowerCase())) return null;
  return d;
}

/** A name this rule produced (starts "{laceCode} | "), as opposed to one a person typed */
export function isGeneratedLaceName(laceCode: string, laceName: string | null | undefined): boolean {
  return !!laceName && laceName.startsWith(`${laceCode} | `);
}

/** A typed value without stray spaces ("Golden ", " frinze lace"), or null when blank */
function clean(value?: string | null): string | null {
  const v = (value ?? '').replace(/\s+/g, ' ').trim();
  return v || null;
}

export async function generateLaceName(lace: LaceNameInput): Promise<string> {
  const parts: string[] = [lace.laceCode];

  // Add laceType (use 'Lace' as fallback)
  parts.push(clean(lace.laceType) || 'Lace');

  const design = laceDesignSegment(lace.design, lace.laceType);
  if (design) {
    parts.push(design);
  }

  // Add composition if present
  const composition = clean(lace.composition);
  if (composition) {
    parts.push(composition);
  }

  // Add width if present
  if (lace.width) {
    parts.push(`${lace.width}"`);
  }

  // Type-specific suffix
  if (lace.isGreige) {
    parts.push('GREIGE');
  } else if (lace.sourceGreigeLaceCode) {
    // Processed lace
    parts.push(clean(lace.color) || 'Unspecified');
    if (lace.processedForStyleCode) {
      const style = await prisma.styles.findFirst({
        where: { styleCode: lace.processedForStyleCode },
        select: { buyerStyleRef: true },
      });
      const styleCodeDisplay = styleCodeLabel({
        styleCode: lace.processedForStyleCode,
        buyerStyleRef: style?.buyerStyleRef,
      });
      parts.push(`${lace.sourceGreigeLaceCode} → ${styleCodeDisplay}`);
    } else {
      // No style yet (e.g. a dyed variant created from the cost sheet). Printing "→ ?" here
      // baked a dangling placeholder into the stored name forever.
      parts.push(`from ${lace.sourceGreigeLaceCode}`);
    }
  } else {
    // Ready lace
    parts.push(clean(lace.color) || 'Unspecified');
  }

  return parts.join(' | ');
}
