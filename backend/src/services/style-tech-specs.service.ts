/**
 * Style Tech Specs Service
 * Manages basic technical specifications for styles
 * Note: Detailed graded specs are handled by Pattern Department
 */
import prisma from '../config/database';
import { NotFoundError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';

export interface TechSpecsDTO {
  overallLength?: number | string;
  topLength?: number | string;
  bottomLength?: number | string;
  lengthUnit?: string;
  sleeveType?: string;
  collarType?: string;
  fitType?: string;
  closureType?: string;
  designNotes?: string;
  constructionNotes?: string;
}

// Enum options for dropdowns
export const SLEEVE_TYPES = [
  'SET_IN',
  'RAGLAN',
  'CAP',
  'SLEEVELESS',
  'BELL',
  'PUFF',
  'BISHOP',
  'DOLMAN',
  'KIMONO',
  'OTHER',
] as const;

export const COLLAR_TYPES = [
  'ROUND_NECK',
  'V_NECK',
  'COLLAR',
  'MANDARIN',
  'BOAT_NECK',
  'CREW_NECK',
  'TURTLE_NECK',
  'COWL_NECK',
  'HALTER',
  'SQUARE_NECK',
  'KEYHOLE',
  'SHAWL',
  'OTHER',
] as const;

export const FIT_TYPES = [
  'SLIM',
  'REGULAR',
  'RELAXED',
  'OVERSIZED',
  'FITTED',
  'LOOSE',
  'A_LINE',
  'BODYCON',
  'OTHER',
] as const;

export const CLOSURE_TYPES = [
  'BUTTONS',
  'ZIPPER',
  'PULLOVER',
  'TIE',
  'WRAP',
  'HOOK_AND_EYE',
  'SNAP',
  'VELCRO',
  'DRAWSTRING',
  'NONE',
  'OTHER',
] as const;

class StyleTechSpecsService {
  /**
   * Get tech specs for a style
   */
  async getByStyleId(styleId: string): Promise<object | null> {
    try {
      logDebug('Getting tech specs', { styleId });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      const specs = await prisma.style_tech_specs.findUnique({
        where: { styleId },
      });

      return specs;
    } catch (error) {
      logError('Failed to get tech specs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Create or update tech specs for a style
   */
  async upsert(styleId: string, data: TechSpecsDTO): Promise<object> {
    try {
      logDebug('Upserting tech specs', { styleId, data });

      // Verify style exists
      const style = await prisma.styles.findUnique({ where: { id: styleId } });
      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      // Convert numeric fields
      const processedData = {
        overallLength: data.overallLength !== undefined && data.overallLength !== ''
          ? parseFloat(String(data.overallLength))
          : null,
        topLength: data.topLength !== undefined && data.topLength !== ''
          ? parseFloat(String(data.topLength))
          : null,
        bottomLength: data.bottomLength !== undefined && data.bottomLength !== ''
          ? parseFloat(String(data.bottomLength))
          : null,
        lengthUnit: data.lengthUnit || 'inches',
        sleeveType: data.sleeveType || null,
        collarType: data.collarType || null,
        fitType: data.fitType || null,
        closureType: data.closureType || null,
        designNotes: data.designNotes || null,
        constructionNotes: data.constructionNotes || null,
      };

      const specs = await prisma.style_tech_specs.upsert({
        where: { styleId },
        update: processedData,
        create: {
          styleId,
          ...processedData,
        },
      });

      logInfo('Tech specs saved successfully', { styleId });
      return specs;
    } catch (error) {
      logError('Failed to save tech specs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete tech specs for a style
   */
  async delete(styleId: string): Promise<void> {
    try {
      logDebug('Deleting tech specs', { styleId });

      // Verify exists
      const existing = await prisma.style_tech_specs.findUnique({
        where: { styleId },
      });
      if (!existing) {
        throw new NotFoundError('Tech Specs for Style', styleId);
      }

      await prisma.style_tech_specs.delete({
        where: { styleId },
      });

      logInfo('Tech specs deleted successfully', { styleId });
    } catch (error) {
      logError('Failed to delete tech specs', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get dropdown options for tech specs form
   */
  getOptions(): object {
    return {
      sleeveTypes: SLEEVE_TYPES,
      collarTypes: COLLAR_TYPES,
      fitTypes: FIT_TYPES,
      closureTypes: CLOSURE_TYPES,
      lengthUnits: ['inches', 'cm'],
    };
  }

  /**
   * Get style with all data needed for tech pack PDF
   * Includes: style info, images, BOM, variants, tech specs
   */
  async getStyleForTechPack(styleId: string): Promise<object> {
    try {
      logDebug('Getting style data for tech pack', { styleId });

      const style = await prisma.styles.findUnique({
        where: { id: styleId },
        include: {
          styleImages: {
            orderBy: { sortOrder: 'asc' },
          },
          techSpecs: true,
          style_material_bom: {
            include: {
              material_master: true,
            },
          },
          style_variants: true,
          style_components: {
            include: {
              component: true,
            },
          },
          brand_categories: true,
          style_categories: true,
          season_master: true,
        },
      });

      if (!style) {
        throw new NotFoundError('Style', styleId);
      }

      return style;
    } catch (error) {
      logError('Failed to get style for tech pack', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const styleTechSpecsService = new StyleTechSpecsService();
