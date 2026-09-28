/**
 * Label name — ONE rule for every writer (create, update, and the regenerate script).
 *
 * Format: {labelCode} | {labelType} | {brand} | {color} | {material} | {size}
 *
 * Only non-empty fields are included. Examples:
 * - LBL-0016 | Main Label | Kasya
 * - LBL-0030 | Washcare | White | Satin | 1*2
 * - LBL-0021 | Liva Tag
 */
import prisma from '../../config/database';

export interface LabelNameInput {
  labelCode: string;
  labelType?: string | null;
  labelCategory?: string | null;
  brandCategoryId?: string | null;
  color?: string | null;
  material?: string | null;
  size?: string | null;
}

/** A typed value without stray spaces, or null when blank */
function clean(value?: string | null): string | null {
  const v = (value ?? '').replace(/\s+/g, ' ').trim();
  return v || null;
}

/** Title case a string: "main label" -> "Main Label" */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** A name this rule produced (starts "{labelCode} | "), as opposed to one a person typed */
export function isGeneratedLabelName(labelCode: string, labelName: string | null | undefined): boolean {
  return !!labelName && labelName.startsWith(`${labelCode} | `);
}

/** Convert labelCategory enum to display text */
function categoryDisplay(category?: string | null): string | null {
  if (!category) return null;
  switch (category) {
    case 'SEWN_IN':
      return 'Sewn-in Label';
    case 'HANGTAG':
      return 'Hangtag';
    case 'PRICE_TAG':
      return 'Price Tag';
    default:
      return titleCase(category.replace(/_/g, ' '));
  }
}

export async function generateLabelName(label: LabelNameInput): Promise<string> {
  const parts: string[] = [label.labelCode];

  // Add labelType if present, otherwise fall back to category
  const labelType = clean(label.labelType);
  if (labelType) {
    parts.push(titleCase(labelType));
  } else {
    const catDisplay = categoryDisplay(label.labelCategory);
    if (catDisplay) {
      parts.push(catDisplay);
    }
  }

  // Add brand name if brandCategoryId is present
  if (label.brandCategoryId) {
    const brand = await prisma.brand_categories.findUnique({
      where: { id: label.brandCategoryId },
      select: { brandName: true },
    });
    if (brand?.brandName) {
      parts.push(clean(brand.brandName) || '');
    }
  }

  // Add color if present
  const color = clean(label.color);
  if (color) {
    parts.push(titleCase(color));
  }

  // Add material if present
  const material = clean(label.material);
  if (material) {
    parts.push(titleCase(material));
  }

  // Add size if present
  const size = clean(label.size);
  if (size) {
    parts.push(size);
  }

  // Filter out empty parts and join
  return parts.filter(Boolean).join(' | ');
}

/** Synchronous version when brand name is already resolved */
export function generateLabelNameSync(label: LabelNameInput & { brandName?: string | null }): string {
  const parts: string[] = [label.labelCode];

  // Add labelType if present, otherwise fall back to category
  const labelType = clean(label.labelType);
  if (labelType) {
    parts.push(titleCase(labelType));
  } else {
    const catDisplay = categoryDisplay(label.labelCategory);
    if (catDisplay) {
      parts.push(catDisplay);
    }
  }

  const brandName = clean(label.brandName);
  if (brandName) {
    parts.push(brandName);
  }

  const color = clean(label.color);
  if (color) {
    parts.push(titleCase(color));
  }

  const material = clean(label.material);
  if (material) {
    parts.push(titleCase(material));
  }

  const size = clean(label.size);
  if (size) {
    parts.push(size);
  }

  return parts.filter(Boolean).join(' | ');
}
