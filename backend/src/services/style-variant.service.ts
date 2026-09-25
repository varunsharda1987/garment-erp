import prisma from '../config/database';
import { StyleVariantData } from '../types/style-variant.types';
import { getSizeOrder } from '../utils/sku-generator';

export class StyleVariantService {
  /**
   * Create or update variants for a style
   */
  async upsertStyleVariants(styleId: string, variants: StyleVariantData[]): Promise<number> {
    let createdCount = 0;

    for (const variant of variants) {
      // Check if variant with this SKU already exists
      const existing = await prisma.style_variants.findUnique({
        where: { sku: variant.sku },
      });

      if (existing) {
        // Update existing variant
        await prisma.style_variants.update({
          where: { id: existing.id },
          data: {
            sizeName: variant.sizeName,
            colorName: variant.colorName,
            sizeId: variant.sizeId,
            colorId: variant.colorId,
            barcode: variant.barcode,
            isActive: variant.isActive ?? true,
            sortOrder: variant.sortOrder ?? getSizeOrder(variant.sizeName ?? ''),
          },
        });
      } else {
        // Create new variant
        await prisma.style_variants.create({
          data: {
            id: `${styleId}-${variant.sku}-${Date.now()}`,
            styleId,
            sku: variant.sku,
            sizeName: variant.sizeName || null,
            colorName: variant.colorName || null,
            sizeId: variant.sizeId || null,
            colorId: variant.colorId || null,
            barcode: variant.barcode || null,
            isActive: variant.isActive ?? true,
            sortOrder: variant.sortOrder ?? getSizeOrder(variant.sizeName ?? ''),
          },
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Get all variants for a style
   */
  async getStyleVariants(styleId: string) {
    return await prisma.style_variants.findMany({
      where: { styleId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get variant by SKU
   */
  async getVariantBySKU(sku: string) {
    return await prisma.style_variants.findUnique({
      where: { sku },
      include: {
        style: true,
        size: true,
        color: true,
      },
    });
  }

  /**
   * Find or create size option
   */
  async findOrCreateSize(styleId: string, sizeName: string): Promise<string | null> {
    if (!sizeName) return null;

    const existing = await prisma.size_options.findFirst({
      where: {
        styleId,
        sizeName,
      },
    });

    // A size read back from the import IS one of the style's sizes: revive it if it was dropped, and
    // give it its XS → XXXL rank (rows this used to create all carried 0, so they read in any order).
    const sortOrder = getSizeOrder(sizeName);
    if (existing) {
      if (!existing.isActive || existing.sortOrder !== sortOrder) {
        await prisma.size_options.update({ where: { id: existing.id }, data: { isActive: true, sortOrder } });
      }
      return existing.id;
    }

    // BUG-MM8 fix: prevent race condition with P2002 handling
    try {
      const newSize = await prisma.size_options.create({
        data: {
          id: `${styleId}-size-${sizeName}-${Date.now()}`,
          styleId,
          sizeName,
          sizeCode: sizeName.toUpperCase(),
          sortOrder,
        },
      });

      return newSize.id;
    } catch (err: any) {
      // Handle race condition: another request created the record between our check and create
      if (err?.code === 'P2002') {
        const justCreated = await prisma.size_options.findFirst({
          where: { styleId, sizeName },
        });
        if (justCreated) return justCreated.id;
      }
      throw err;
    }
  }

  // `findOrCreateColor` lived here until 2026-09-14 and had ZERO callers anywhere in the repo —
  // which is why `color_options` was empty for all 1,130 styles. It also wrote `colorMasterId: null`,
  // leaving the colourway unlinked from the colour catalogue. Colourways now come from the style's
  // Primary Color through the single writer: services/helpers/style-colour.helper.ts.
}

export default new StyleVariantService();
