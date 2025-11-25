import { PrismaClient } from '@prisma/client';
import { StyleVariantData } from '../types/style-variant.types';

const prisma = new PrismaClient();

export class StyleVariantService {
  /**
   * Create or update variants for a style
   */
  async upsertStyleVariants(
    styleId: string,
    variants: StyleVariantData[]
  ): Promise<number> {
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
            sortOrder: variant.sortOrder ?? 0,
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
            sortOrder: variant.sortOrder ?? 0,
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

    if (existing) return existing.id;

    const newSize = await prisma.size_options.create({
      data: {
        id: `${styleId}-size-${sizeName}-${Date.now()}`,
        styleId,
        sizeName,
        sizeCode: sizeName.toUpperCase(),
        sortOrder: 0,
      },
    });

    return newSize.id;
  }

  /**
   * Find or create color option
   */
  async findOrCreateColor(styleId: string, colorName: string): Promise<string | null> {
    if (!colorName) return null;

    const existing = await prisma.color_options.findFirst({
      where: {
        styleId,
        colorName,
      },
    });

    if (existing) return existing.id;

    const newColor = await prisma.color_options.create({
      data: {
        id: `${styleId}-color-${colorName}-${Date.now()}`,
        styleId,
        colorName,
        colorCode: null,
        sortOrder: 0,
      },
    });

    return newColor.id;
  }
}

export default new StyleVariantService();
