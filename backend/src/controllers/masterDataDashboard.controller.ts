import { Request, Response } from 'express';
import logger from '../utils/logger';
import prisma from '../config/database';

/**
 * Master Data Dashboard Controller
 * Provides unified summary across all master data types
 */

/**
 * Get summary of all master data types with counts
 */
export const getMasterDataSummary = async (req: Request, res: Response) => {
  try {
    // Query all counts in parallel for performance
    const [
      materialsTotal,
      materialsActive,
      greigeTotal,
      greigeActive,
      fabricTotal,
      fabricActive,
      embroideryTotal,
      embroideryActive,
      buttonsTotal,
      buttonsActive,
      zippersTotal,
      zippersActive,
      threadsTotal,
      threadsActive,
      elasticTotal,
      elasticActive,
      lacesTotal,
      lacesActive,
      labelsTotal,
      labelsActive,
      packagingTotal,
      packagingActive,
      // Generic trims
      hookEyeTotal,
      hookEyeActive,
      snapButtonTotal,
      snapButtonActive,
      buckleTotal,
      buckleActive,
      beltTotal,
      beltActive,
      velcroTotal,
      velcroActive,
      drawstringTotal,
      drawstringActive,
      ribbonTotal,
      ribbonActive,
      sequinTotal,
      sequinActive,
      beadTotal,
      beadActive,
      motifTotal,
      motifActive,
      interliningTotal,
      interliningActive,
      paddingTotal,
      paddingActive,
      otherFastenerTotal,
      otherFastenerActive,
      otherTapeTotal,
      otherTapeActive,
      otherDecorativeTotal,
      otherDecorativeActive,
      otherFunctionalTotal,
      otherFunctionalActive,
    ] = await Promise.all([
      prisma.materials.count({ where: { materialType: 'GENERIC' } }),
      prisma.materials.count({ where: { materialType: 'GENERIC', isActive: true } }),
      prisma.greige_master.count(),
      prisma.greige_master.count({ where: { isActive: true } }),
      prisma.fabric_master.count(),
      prisma.fabric_master.count({ where: { isActive: true } }),
      prisma.embroidery_master.count(),
      prisma.embroidery_master.count({ where: { isActive: true } }),
      prisma.button_master.count(),
      prisma.button_master.count({ where: { isActive: true } }),
      prisma.zipper_master.count(),
      prisma.zipper_master.count({ where: { isActive: true } }),
      prisma.thread_master.count(),
      prisma.thread_master.count({ where: { isActive: true } }),
      prisma.elastic_master.count(),
      prisma.elastic_master.count({ where: { isActive: true } }),
      prisma.lace_master.count(),
      prisma.lace_master.count({ where: { isActive: true } }),
      prisma.label_master.count(),
      prisma.label_master.count({ where: { isActive: true } }),
      prisma.packaging_master.count(),
      prisma.packaging_master.count({ where: { isActive: true } }),
      // Generic trims
      prisma.hook_eye_master.count(),
      prisma.hook_eye_master.count({ where: { isActive: true } }),
      prisma.snap_button_master.count(),
      prisma.snap_button_master.count({ where: { isActive: true } }),
      prisma.buckle_master.count(),
      prisma.buckle_master.count({ where: { isActive: true } }),
      prisma.belt_master.count(),
      prisma.belt_master.count({ where: { isActive: true } }),
      prisma.velcro_master.count(),
      prisma.velcro_master.count({ where: { isActive: true } }),
      prisma.drawstring_master.count(),
      prisma.drawstring_master.count({ where: { isActive: true } }),
      prisma.ribbon_master.count(),
      prisma.ribbon_master.count({ where: { isActive: true } }),
      prisma.sequin_master.count(),
      prisma.sequin_master.count({ where: { isActive: true } }),
      prisma.bead_master.count(),
      prisma.bead_master.count({ where: { isActive: true } }),
      prisma.motif_master.count(),
      prisma.motif_master.count({ where: { isActive: true } }),
      prisma.interlining_master.count(),
      prisma.interlining_master.count({ where: { isActive: true } }),
      prisma.padding_master.count(),
      prisma.padding_master.count({ where: { isActive: true } }),
      prisma.other_fastener_master.count(),
      prisma.other_fastener_master.count({ where: { isActive: true } }),
      prisma.other_tape_master.count(),
      prisma.other_tape_master.count({ where: { isActive: true } }),
      prisma.other_decorative_master.count(),
      prisma.other_decorative_master.count({ where: { isActive: true } }),
      prisma.other_functional_master.count(),
      prisma.other_functional_master.count({ where: { isActive: true } }),
    ]);

    const summary = {
      fabricsRawMaterials: {
        category: 'Fabrics & Raw Materials',
        totalCount: greigeTotal + fabricTotal + embroideryTotal,
        activeCount: greigeActive + fabricActive + embroideryActive,
        masters: [
          {
            type: 'greige',
            label: 'Greige Master',
            count: greigeTotal,
            active: greigeActive,
            route: '/greige',
          },
          {
            type: 'fabric',
            label: 'Fabric Master',
            count: fabricTotal,
            active: fabricActive,
            route: '/fabric',
          },
          {
            type: 'embroidery',
            label: 'Embroidery',
            count: embroideryTotal,
            active: embroideryActive,
            route: '/embroidery',
          },
        ],
      },
      otherMaterials: {
        category: 'Other Materials',
        totalCount: materialsTotal,
        activeCount: materialsActive,
        masters: [
          {
            type: 'materials',
            label: 'Generic Materials',
            count: materialsTotal,
            active: materialsActive,
            route: '/materials',
          },
        ],
      },
      fastenersClosures: {
        category: 'Fasteners & Closures',
        totalCount:
          buttonsTotal +
          zippersTotal +
          hookEyeTotal +
          snapButtonTotal +
          buckleTotal +
          beltTotal +
          velcroTotal +
          otherFastenerTotal,
        activeCount:
          buttonsActive +
          zippersActive +
          hookEyeActive +
          snapButtonActive +
          buckleActive +
          beltActive +
          velcroActive +
          otherFastenerActive,
        masters: [
          {
            type: 'buttons',
            label: 'Buttons',
            count: buttonsTotal,
            active: buttonsActive,
            route: '/materials/button',
          },
          {
            type: 'zippers',
            label: 'Zippers',
            count: zippersTotal,
            active: zippersActive,
            route: '/materials/zipper',
          },
          {
            type: 'hookEye',
            label: 'Hook & Eye',
            count: hookEyeTotal,
            active: hookEyeActive,
            route: '/materials/hook-eye',
          },
          {
            type: 'snapButton',
            label: 'Snap Buttons',
            count: snapButtonTotal,
            active: snapButtonActive,
            route: '/materials/snap-button',
          },
          {
            type: 'buckle',
            label: 'Buckles',
            count: buckleTotal,
            active: buckleActive,
            route: '/materials/buckle',
          },
          {
            type: 'belt',
            label: 'Belts',
            count: beltTotal,
            active: beltActive,
            route: '/materials/belt',
          },
          {
            type: 'velcro',
            label: 'Velcro',
            count: velcroTotal,
            active: velcroActive,
            route: '/materials/velcro',
          },
          {
            type: 'otherFastener',
            label: 'Other Fasteners',
            count: otherFastenerTotal,
            active: otherFastenerActive,
            route: '/materials/other-fastener',
          },
        ],
      },
      threadsTapes: {
        category: 'Threads & Tapes',
        totalCount: threadsTotal + elasticTotal + drawstringTotal + ribbonTotal + otherTapeTotal,
        activeCount: threadsActive + elasticActive + drawstringActive + ribbonActive + otherTapeActive,
        masters: [
          {
            type: 'threads',
            label: 'Threads',
            count: threadsTotal,
            active: threadsActive,
            route: '/materials/thread',
          },
          {
            type: 'elastic',
            label: 'Elastic',
            count: elasticTotal,
            active: elasticActive,
            route: '/materials/elastic',
          },
          {
            type: 'drawstring',
            label: 'Drawstring',
            count: drawstringTotal,
            active: drawstringActive,
            route: '/materials/drawstring',
          },
          {
            type: 'ribbon',
            label: 'Ribbon',
            count: ribbonTotal,
            active: ribbonActive,
            route: '/materials/ribbon',
          },
          {
            type: 'otherTape',
            label: 'Other Tapes',
            count: otherTapeTotal,
            active: otherTapeActive,
            route: '/materials/other-tape',
          },
        ],
      },
      decorative: {
        category: 'Decorative',
        totalCount: lacesTotal + sequinTotal + beadTotal + motifTotal + otherDecorativeTotal,
        activeCount: lacesActive + sequinActive + beadActive + motifActive + otherDecorativeActive,
        masters: [
          {
            type: 'laces',
            label: 'Laces',
            count: lacesTotal,
            active: lacesActive,
            route: '/materials/lace',
          },
          {
            type: 'sequin',
            label: 'Sequins',
            count: sequinTotal,
            active: sequinActive,
            route: '/materials/sequin',
          },
          {
            type: 'bead',
            label: 'Beads',
            count: beadTotal,
            active: beadActive,
            route: '/materials/bead',
          },
          {
            type: 'motif',
            label: 'Motifs',
            count: motifTotal,
            active: motifActive,
            route: '/materials/motif',
          },
          {
            type: 'otherDecorative',
            label: 'Other Decorative',
            count: otherDecorativeTotal,
            active: otherDecorativeActive,
            route: '/materials/other-decorative',
          },
        ],
      },
      packagingLabels: {
        category: 'Packaging & Labels',
        totalCount: labelsTotal + packagingTotal,
        activeCount: labelsActive + packagingActive,
        masters: [
          {
            type: 'labels',
            label: 'Labels',
            count: labelsTotal,
            active: labelsActive,
            route: '/materials/label',
          },
          {
            type: 'packaging',
            label: 'Packaging',
            count: packagingTotal,
            active: packagingActive,
            route: '/materials/packaging',
          },
        ],
      },
      functional: {
        category: 'Functional',
        totalCount: interliningTotal + paddingTotal + otherFunctionalTotal,
        activeCount: interliningActive + paddingActive + otherFunctionalActive,
        masters: [
          {
            type: 'interlining',
            label: 'Interlining',
            count: interliningTotal,
            active: interliningActive,
            route: '/materials/interlining',
          },
          {
            type: 'padding',
            label: 'Padding',
            count: paddingTotal,
            active: paddingActive,
            route: '/materials/padding',
          },
          {
            type: 'otherFunctional',
            label: 'Other Functional',
            count: otherFunctionalTotal,
            active: otherFunctionalActive,
            route: '/materials/other-functional',
          },
        ],
      },
    };

    // Calculate totals across all categories
    const totalItems = Object.values(summary).reduce((sum, cat) => sum + cat.totalCount, 0);
    const activeItems = Object.values(summary).reduce((sum, cat) => sum + cat.activeCount, 0);

    res.json({
      success: true,
      data: {
        summary,
        totals: {
          totalItems,
          activeItems,
          categories: Object.keys(summary).length,
        },
      },
    });
  } catch (error: unknown) {
    logger.error('Error fetching master data summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch master data summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
