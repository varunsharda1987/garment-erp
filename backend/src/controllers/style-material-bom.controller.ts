// Style Material BOM Controller - Phase 2
import { Request, Response } from 'express';
import prisma from '../config/database';
import { MaterialType, MaterialUsageCategory, Prisma } from '@prisma/client';
import { logInfo, logDebug } from '../utils/logger';
import { randomUUID } from 'crypto';
import { ValidationError, NotFoundError } from '../errors';
// BUG-STY8 fix: Use decimal.js for precise BOM quantity calculations
import { toCurrency, multiplyCurrency, addCurrency, toNumber } from '../utils/currency';
import { systemSettingsService } from '../services/system-settings.service';

/**
 * Search materials by type and query string
 * GET /api/styles/materials/search
 * Query params: type (MaterialType), query (string), limit (number)
 */
export const searchMaterials = async (req: Request, res: Response): Promise<void> => {
  const { type, query, limit = 20 } = req.query;

  if (!type) {
    throw new ValidationError('Material type is required');
  }

  const materialType = type as MaterialType;
  const searchQuery = (query as string) || '';
  const limitNum = Number(limit);

  logDebug(`Searching materials: type=${type}, query=${searchQuery}`);

  // Build search based on material type
  let materials: any[] = [];

  switch (materialType) {
    case 'LACE':
      const laces = await prisma.lace_master.findMany({
        where: {
          isActive: true,
          OR: [
            { laceName: { contains: searchQuery, mode: 'insensitive' } },
            { laceCode: { contains: searchQuery, mode: 'insensitive' } },
            { color: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { laceName: 'asc' },
      });

      materials = laces.map((lace) => ({
        masterRecordId: lace.id,
        materialId: lace.materials[0]?.id,
        materialCode: lace.laceCode,
        materialName: lace.laceName,
        materialType: 'LACE',
        specifications: {
          width: lace.width?.toString(),
          design: lace.design,
          color: lace.color,
          composition: lace.composition,
        },
        pricePerUnit: lace.pricePerMeter?.toString(),
        unit: 'meters',
        supplierName: lace.suppliers?.name,
        image: lace.image,
        isActive: lace.isActive,
      }));
      break;

    case 'BUTTON':
      const buttons = await prisma.button_master.findMany({
        where: {
          isActive: true,
          OR: [
            { buttonName: { contains: searchQuery, mode: 'insensitive' } },
            { buttonCode: { contains: searchQuery, mode: 'insensitive' } },
            { color: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { buttonName: 'asc' },
      });

      materials = buttons.map((button) => ({
        masterRecordId: button.id,
        materialId: button.materials[0]?.id,
        materialCode: button.buttonCode,
        materialName: button.buttonName,
        materialType: 'BUTTON',
        specifications: {
          size: button.size,
          holes: button.holes,
          color: button.color,
          material: button.material,
          shape: button.shape,
        },
        pricePerUnit: button.pricePerPiece?.toString(),
        pricePerGross: button.pricePerGross?.toString(),
        unit: 'pcs',
        supplierName: button.suppliers?.name,
        image: button.image,
        isActive: button.isActive,
      }));
      break;

    case 'THREAD':
      const threads = await prisma.thread_master.findMany({
        where: {
          isActive: true,
          OR: [
            { threadName: { contains: searchQuery, mode: 'insensitive' } },
            { threadCode: { contains: searchQuery, mode: 'insensitive' } },
            { color: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { threadName: 'asc' },
      });

      materials = threads.map((thread) => ({
        masterRecordId: thread.id,
        materialId: thread.materials[0]?.id,
        materialCode: thread.threadCode,
        materialName: thread.threadName,
        materialType: 'THREAD',
        specifications: {
          brand: thread.brand,
          packagingType: thread.packagingType,
          piecesPerBox: thread.piecesPerBox,
          metersPerUnit: thread.metersPerUnit?.toString(),
          color: thread.color,
          colorCode: thread.colorCode,
          coneSize: thread.coneSize,
        },
        pricePerUnit: thread.pricePerCone?.toString(),
        unit: 'cones',
        supplierName: thread.suppliers?.name,
        image: thread.image,
        isActive: thread.isActive,
      }));
      break;

    case 'ZIPPER':
      const zippers = await prisma.zipper_master.findMany({
        where: {
          isActive: true,
          OR: [
            { zipperName: { contains: searchQuery, mode: 'insensitive' } },
            { zipperCode: { contains: searchQuery, mode: 'insensitive' } },
            { color: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { zipperName: 'asc' },
      });

      materials = zippers.map((zipper) => ({
        masterRecordId: zipper.id,
        materialId: zipper.materials[0]?.id,
        materialCode: zipper.zipperCode,
        materialName: zipper.zipperName,
        materialType: 'ZIPPER',
        specifications: {
          length: zipper.length?.toString(),
          teethType: zipper.teethType,
          color: zipper.color,
          brand: zipper.brand,
          sliderType: zipper.sliderType,
          tapeWidth: zipper.tapeWidth?.toString(),
        },
        pricePerUnit: zipper.pricePerPiece?.toString(),
        unit: 'pcs',
        supplierName: zipper.suppliers?.name,
        image: zipper.image,
        isActive: zipper.isActive,
      }));
      break;

    case 'ELASTIC':
      const elastics = await prisma.elastic_master.findMany({
        where: {
          isActive: true,
          OR: [
            { elasticName: { contains: searchQuery, mode: 'insensitive' } },
            { elasticCode: { contains: searchQuery, mode: 'insensitive' } },
            { color: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { elasticName: 'asc' },
      });

      materials = elastics.map((elastic) => ({
        masterRecordId: elastic.id,
        materialId: elastic.materials[0]?.id,
        materialCode: elastic.elasticCode,
        materialName: elastic.elasticName,
        materialType: 'ELASTIC',
        specifications: {
          width: elastic.width?.toString(),
          stretchPercent: elastic.stretchPercent?.toString(),
          color: elastic.color,
          composition: elastic.composition,
          elasticType: elastic.elasticType,
        },
        pricePerUnit: elastic.pricePerMeter?.toString(),
        unit: 'meters',
        supplierName: elastic.suppliers?.name,
        image: elastic.image,
        isActive: elastic.isActive,
      }));
      break;

    case 'LABEL':
      const labels = await prisma.label_master.findMany({
        where: {
          isActive: true,
          OR: [
            { labelName: { contains: searchQuery, mode: 'insensitive' } },
            { labelCode: { contains: searchQuery, mode: 'insensitive' } },
            { labelType: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { labelName: 'asc' },
      });

      materials = labels.map((label) => ({
        masterRecordId: label.id,
        materialId: label.materials[0]?.id,
        materialCode: label.labelCode,
        materialName: label.labelName,
        materialType: 'LABEL',
        specifications: {
          labelType: label.labelType,
          size: label.size,
          content: label.content,
          printMethod: label.printMethod,
          material: label.material,
          color: label.color,
        },
        pricePerUnit: label.pricePerPiece?.toString(),
        pricePerHundred: label.pricePerHundred?.toString(),
        unit: 'pcs',
        supplierName: label.suppliers?.name,
        image: label.image,
        isActive: label.isActive,
      }));
      break;

    case 'PACKAGING':
      const packaging = await prisma.packaging_master.findMany({
        where: {
          isActive: true,
          OR: [
            { packagingName: { contains: searchQuery, mode: 'insensitive' } },
            { packagingCode: { contains: searchQuery, mode: 'insensitive' } },
            { packagingType: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        include: {
          suppliers: { select: { name: true } },
          materials: { select: { id: true, code: true } },
        },
        take: limitNum,
        orderBy: { packagingName: 'asc' },
      });

      materials = packaging.map((pkg) => ({
        masterRecordId: pkg.id,
        materialId: pkg.materials[0]?.id,
        materialCode: pkg.packagingCode,
        materialName: pkg.packagingName,
        materialType: 'PACKAGING',
        specifications: {
          packagingType: pkg.packagingType,
          size: pkg.size,
          material: pkg.material,
          thickness: pkg.thickness,
          printDetails: pkg.printDetails,
        },
        pricePerUnit: pkg.pricePerPiece?.toString(),
        pricePerHundred: pkg.pricePerHundred?.toString(),
        unit: 'pcs',
        supplierName: pkg.suppliers?.name,
        image: pkg.image,
        isActive: pkg.isActive,
      }));
      break;

    default:
      throw new ValidationError(`Material type ${materialType} is not supported for BOM`);
  }

  logInfo(`Found ${materials.length} materials for type ${materialType}`);

  res.json({
    materials,
    count: materials.length,
  });
};

/**
 * Get material by code
 * GET /api/styles/materials/by-code/:materialCode
 */
export const getMaterialByCode = async (req: Request, res: Response): Promise<void> => {
  const { materialCode } = req.params;

  if (!materialCode) {
    throw new ValidationError('Material code is required');
  }

  logDebug(`Fetching material by code: ${materialCode}`);

  // Determine material type from code prefix
  let materialType: MaterialType | null = null;
  let material: any = null;

  if (materialCode.startsWith('LACE-')) {
    materialType = 'LACE';
    const lace = await prisma.lace_master.findFirst({
      where: { laceCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (lace) {
      material = {
        masterRecordId: lace.id,
        materialId: lace.materials[0]?.id,
        materialCode: lace.laceCode,
        materialName: lace.laceName,
        materialType: 'LACE',
        specifications: {
          width: lace.width?.toString(),
          design: lace.design,
          color: lace.color,
          composition: lace.composition,
        },
        pricePerUnit: lace.pricePerMeter?.toString(),
        unit: 'meters',
        supplierName: lace.suppliers?.name,
        image: lace.image,
      };
    }
  } else if (materialCode.startsWith('BTN-')) {
    materialType = 'BUTTON';
    const button = await prisma.button_master.findFirst({
      where: { buttonCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (button) {
      material = {
        masterRecordId: button.id,
        materialId: button.materials[0]?.id,
        materialCode: button.buttonCode,
        materialName: button.buttonName,
        materialType: 'BUTTON',
        specifications: {
          size: button.size,
          holes: button.holes,
          color: button.color,
          material: button.material,
          shape: button.shape,
        },
        pricePerUnit: button.pricePerPiece?.toString(),
        pricePerGross: button.pricePerGross?.toString(),
        unit: 'pcs',
        supplierName: button.suppliers?.name,
        image: button.image,
      };
    }
  } else if (materialCode.startsWith('THR-')) {
    materialType = 'THREAD';
    const thread = await prisma.thread_master.findFirst({
      where: { threadCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (thread) {
      material = {
        masterRecordId: thread.id,
        materialId: thread.materials[0]?.id,
        materialCode: thread.threadCode,
        materialName: thread.threadName,
        materialType: 'THREAD',
        specifications: {
          brand: thread.brand,
          packagingType: thread.packagingType,
          piecesPerBox: thread.piecesPerBox,
          metersPerUnit: thread.metersPerUnit?.toString(),
          color: thread.color,
          colorCode: thread.colorCode,
          coneSize: thread.coneSize,
        },
        pricePerUnit: thread.pricePerCone?.toString(),
        unit: 'cones',
        supplierName: thread.suppliers?.name,
        image: thread.image,
      };
    }
  } else if (materialCode.startsWith('ZIP-')) {
    materialType = 'ZIPPER';
    const zipper = await prisma.zipper_master.findFirst({
      where: { zipperCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (zipper) {
      material = {
        masterRecordId: zipper.id,
        materialId: zipper.materials[0]?.id,
        materialCode: zipper.zipperCode,
        materialName: zipper.zipperName,
        materialType: 'ZIPPER',
        specifications: {
          length: zipper.length?.toString(),
          teethType: zipper.teethType,
          color: zipper.color,
          brand: zipper.brand,
          sliderType: zipper.sliderType,
        },
        pricePerUnit: zipper.pricePerPiece?.toString(),
        unit: 'pcs',
        supplierName: zipper.suppliers?.name,
        image: zipper.image,
      };
    }
  } else if (materialCode.startsWith('ELA-')) {
    materialType = 'ELASTIC';
    const elastic = await prisma.elastic_master.findFirst({
      where: { elasticCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (elastic) {
      material = {
        masterRecordId: elastic.id,
        materialId: elastic.materials[0]?.id,
        materialCode: elastic.elasticCode,
        materialName: elastic.elasticName,
        materialType: 'ELASTIC',
        specifications: {
          width: elastic.width?.toString(),
          stretchPercent: elastic.stretchPercent?.toString(),
          color: elastic.color,
          composition: elastic.composition,
          elasticType: elastic.elasticType,
        },
        pricePerUnit: elastic.pricePerMeter?.toString(),
        unit: 'meters',
        supplierName: elastic.suppliers?.name,
        image: elastic.image,
      };
    }
  } else if (materialCode.startsWith('LBL-')) {
    materialType = 'LABEL';
    const label = await prisma.label_master.findFirst({
      where: { labelCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (label) {
      material = {
        masterRecordId: label.id,
        materialId: label.materials[0]?.id,
        materialCode: label.labelCode,
        materialName: label.labelName,
        materialType: 'LABEL',
        specifications: {
          labelType: label.labelType,
          size: label.size,
          content: label.content,
          printMethod: label.printMethod,
          material: label.material,
          color: label.color,
        },
        pricePerUnit: label.pricePerPiece?.toString(),
        pricePerHundred: label.pricePerHundred?.toString(),
        unit: 'pcs',
        supplierName: label.suppliers?.name,
        image: label.image,
      };
    }
  } else if (materialCode.startsWith('PKG-')) {
    materialType = 'PACKAGING';
    const pkg = await prisma.packaging_master.findFirst({
      where: { packagingCode: materialCode, isActive: true },
      include: {
        suppliers: { select: { name: true } },
        materials: { select: { id: true, code: true } },
      },
    });

    if (pkg) {
      material = {
        masterRecordId: pkg.id,
        materialId: pkg.materials[0]?.id,
        materialCode: pkg.packagingCode,
        materialName: pkg.packagingName,
        materialType: 'PACKAGING',
        specifications: {
          packagingType: pkg.packagingType,
          size: pkg.size,
          material: pkg.material,
          thickness: pkg.thickness,
          printDetails: pkg.printDetails,
        },
        pricePerUnit: pkg.pricePerPiece?.toString(),
        pricePerHundred: pkg.pricePerHundred?.toString(),
        unit: 'pcs',
        supplierName: pkg.suppliers?.name,
        image: pkg.image,
      };
    }
  }

  if (!material) {
    throw new NotFoundError('Material', materialCode);
  }

  res.json({ material });
};

/**
 * Get complete BOM for a style
 * GET /api/styles/:styleId/bom
 */
export const getStyleBOM = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  logDebug(`Fetching BOM for style: ${styleId}`);

  // Get style info
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
    select: { styleCode: true, styleName: true },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Get all BOM items with material details
  const bomItems = await prisma.style_material_bom.findMany({
    where: {
      styleId,
      isActive: true,
    },
    include: {
      lace_master: { select: { laceCode: true, laceName: true, pricePerMeter: true } },
      button_master: { select: { buttonCode: true, buttonName: true, pricePerPiece: true } },
      thread_master: { select: { threadCode: true, threadName: true, pricePerCone: true } },
      zipper_master: { select: { zipperCode: true, zipperName: true, pricePerPiece: true } },
      elastic_master: { select: { elasticCode: true, elasticName: true, pricePerMeter: true } },
      label_master: { select: { labelCode: true, labelName: true, pricePerPiece: true } },
      packaging_master: { select: { packagingCode: true, packagingName: true, pricePerPiece: true } },
    },
    orderBy: [{ usageCategory: 'asc' }, { sortOrder: 'asc' }],
  });

  // Group by category
  const garmentTrims: any[] = [];
  const valueAdditions: any[] = [];
  const packaging: any[] = [];

  // BUG-STY8 fix: Use decimal.js for accumulating costs to avoid floating point errors
  let totalGarmentTrimsCost = toCurrency(0);
  let totalValueAdditionsCost = toCurrency(0);
  let totalPackagingCost = toCurrency(0);

  bomItems.forEach((item) => {
    // Get material name and code
    let materialCode = '';
    let materialName = '';

    if (item.laceId && item.lace_master) {
      materialCode = item.lace_master.laceCode;
      materialName = item.lace_master.laceName;
    } else if (item.buttonId && item.button_master) {
      materialCode = item.button_master.buttonCode;
      materialName = item.button_master.buttonName;
    } else if (item.threadId && item.thread_master) {
      materialCode = item.thread_master.threadCode;
      materialName = item.thread_master.threadName;
    } else if (item.zipperId && item.zipper_master) {
      materialCode = item.zipper_master.zipperCode;
      materialName = item.zipper_master.zipperName;
    } else if (item.elasticId && item.elastic_master) {
      materialCode = item.elastic_master.elasticCode;
      materialName = item.elastic_master.elasticName;
    } else if (item.labelId && item.label_master) {
      materialCode = item.label_master.labelCode;
      materialName = item.label_master.labelName;
    } else if (item.packagingId && item.packaging_master) {
      materialCode = item.packaging_master.packagingCode;
      materialName = item.packaging_master.packagingName;
    }

    const bomEntry = {
      id: item.id,
      materialCode,
      materialName,
      materialType: item.materialType,
      componentName: item.componentName,
      quantityPerGarment: item.quantityPerGarment.toString(),
      unit: item.unit,
      unitPrice: item.unitPrice?.toString() || '0',
      totalCost: item.totalCost?.toString() || '0',
      notes: item.notes,
    };

    // BUG-STY8 fix: Use toCurrency for safe decimal accumulation
    const cost = toCurrency(item.totalCost?.toString() || '0');

    if (item.usageCategory === 'GARMENT_TRIM') {
      garmentTrims.push(bomEntry);
      totalGarmentTrimsCost = totalGarmentTrimsCost.plus(cost);
    } else if (item.usageCategory === 'VALUE_ADDITION') {
      valueAdditions.push(bomEntry);
      totalValueAdditionsCost = totalValueAdditionsCost.plus(cost);
    } else if (item.usageCategory === 'PACKAGING') {
      packaging.push(bomEntry);
      totalPackagingCost = totalPackagingCost.plus(cost);
    }
  });

  // BUG-STY8 fix: Use decimal.js for final sum
  const totalMaterialCost = totalGarmentTrimsCost.plus(totalValueAdditionsCost).plus(totalPackagingCost);

  // BUG-STY8 fix: Decimal.toFixed() works the same as Number.toFixed()
  res.json({
    styleCode: style.styleCode,
    styleName: style.styleName,
    materialBOM: {
      garmentTrims,
      valueAdditions,
      packaging,
    },
    costSummary: {
      garmentTrimsCost: totalGarmentTrimsCost.toFixed(2),
      valueAdditionsCost: totalValueAdditionsCost.toFixed(2),
      packagingCost: totalPackagingCost.toFixed(2),
      totalMaterialCost: totalMaterialCost.toFixed(2),
    },
  });
};

/**
 * Add material to style BOM
 * POST /api/styles/:styleId/materials
 */
export const addMaterialToBOM = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { materialCode, usageCategory, componentName, quantityPerGarment, unit, notes, extraPercentage } = req.body;

  logDebug(`Adding material to BOM: style=${styleId}, material=${materialCode}`);

  // Validation
  if (!materialCode || !usageCategory || !quantityPerGarment || !unit) {
    throw new ValidationError('materialCode, usageCategory, quantityPerGarment, and unit are required');
  }

  // Verify style exists
  const style = await prisma.styles.findUnique({
    where: { id: styleId },
  });

  if (!style) {
    throw new NotFoundError('Style', styleId);
  }

  // Resolve the material master from the code prefix (below). Do NOT call the res-writing
  // getMaterialByCode() handler internally — it reads req.params.materialCode (absent on this
  // route), which threw a 400 before any of this ran and made the endpoint dead-on-arrival.

  let materialId: string | undefined;
  let masterRecordId: string | undefined;
  let materialType: MaterialType | undefined;
  let unitPrice: number = 0;

  // Determine material type and fetch details
  if (materialCode.startsWith('LACE-')) {
    const lace = await prisma.lace_master.findFirst({
      where: { laceCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!lace) {
      throw new NotFoundError('Lace material', materialCode);
    }

    materialId = lace.materials[0]?.id;
    masterRecordId = lace.id;
    materialType = 'LACE';
    unitPrice = parseFloat(lace.pricePerMeter?.toString() || '0');
  } else if (materialCode.startsWith('BTN-')) {
    const button = await prisma.button_master.findFirst({
      where: { buttonCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!button) {
      throw new NotFoundError('Button material', materialCode);
    }

    materialId = button.materials[0]?.id;
    masterRecordId = button.id;
    materialType = 'BUTTON';
    unitPrice = parseFloat(button.pricePerPiece?.toString() || '0');
  } else if (materialCode.startsWith('THR-')) {
    const thread = await prisma.thread_master.findFirst({
      where: { threadCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!thread) {
      throw new NotFoundError('Thread material', materialCode);
    }

    materialId = thread.materials[0]?.id;
    masterRecordId = thread.id;
    materialType = 'THREAD';
    unitPrice = parseFloat(thread.pricePerCone?.toString() || '0');
  } else if (materialCode.startsWith('ZIP-')) {
    const zipper = await prisma.zipper_master.findFirst({
      where: { zipperCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!zipper) {
      throw new NotFoundError('Zipper material', materialCode);
    }

    materialId = zipper.materials[0]?.id;
    masterRecordId = zipper.id;
    materialType = 'ZIPPER';
    unitPrice = parseFloat(zipper.pricePerPiece?.toString() || '0');
  } else if (materialCode.startsWith('ELA-')) {
    const elastic = await prisma.elastic_master.findFirst({
      where: { elasticCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!elastic) {
      throw new NotFoundError('Elastic material', materialCode);
    }

    materialId = elastic.materials[0]?.id;
    masterRecordId = elastic.id;
    materialType = 'ELASTIC';
    unitPrice = parseFloat(elastic.pricePerMeter?.toString() || '0');
  } else if (materialCode.startsWith('LBL-')) {
    const label = await prisma.label_master.findFirst({
      where: { labelCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!label) {
      throw new NotFoundError('Label material', materialCode);
    }

    materialId = label.materials[0]?.id;
    masterRecordId = label.id;
    materialType = 'LABEL';
    unitPrice = parseFloat(label.pricePerPiece?.toString() || '0');
  } else if (materialCode.startsWith('PKG-')) {
    const pkg = await prisma.packaging_master.findFirst({
      where: { packagingCode: materialCode, isActive: true },
      include: { materials: true },
    });

    if (!pkg) {
      throw new NotFoundError('Packaging material', materialCode);
    }

    materialId = pkg.materials[0]?.id;
    masterRecordId = pkg.id;
    materialType = 'PACKAGING';
    unitPrice = parseFloat(pkg.pricePerPiece?.toString() || '0');
  } else {
    throw new ValidationError('Material code format not recognized');
  }

  if (!materialId) {
    throw new NotFoundError('Material', materialCode);
  }

  // BUG-STY8 fix: Use decimal.js for precise total cost calculation
  const quantityDecimal = toCurrency(quantityPerGarment);
  const totalCost = toNumber(multiplyCurrency(quantityPerGarment, unitPrice));

  // Build the data object for BOM creation
  // BUG-STY8 fix: Convert Decimal back to number for Prisma storage
  const bomData: any = {
    id: randomUUID(),
    styleId,
    materialId,
    materialType,
    usageCategory: usageCategory as MaterialUsageCategory,
    componentName,
    quantityPerGarment: toNumber(quantityDecimal),
    unit,
    unitPrice,
    totalCost,
    notes,
    // Resolve the wastage default HERE rather than letting the DB column default fire.
    // `?? ` not `|| ` — an explicit 0 is a real choice and must not fall through.
    extraPercentage: extraPercentage ?? (await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT')),
  };

  // Set the appropriate master ID based on material type
  if (materialType === 'LACE') bomData.laceId = masterRecordId;
  else if (materialType === 'BUTTON') bomData.buttonId = masterRecordId;
  else if (materialType === 'THREAD') bomData.threadId = masterRecordId;
  else if (materialType === 'ZIPPER') bomData.zipperId = masterRecordId;
  else if (materialType === 'ELASTIC') bomData.elasticId = masterRecordId;
  else if (materialType === 'LABEL') bomData.labelId = masterRecordId;
  else if (materialType === 'PACKAGING') bomData.packagingId = masterRecordId;

  // Create BOM entry
  const bomEntry = await prisma.style_material_bom.create({
    data: bomData,
  });

  logInfo(`Material added to BOM: ${materialCode} for style ${style.styleCode}`);

  res.status(201).json({
    message: 'Material added to BOM successfully',
    bomEntry: {
      id: bomEntry.id,
      materialCode,
      materialType: bomEntry.materialType,
      usageCategory: bomEntry.usageCategory,
      componentName: bomEntry.componentName,
      quantityPerGarment: bomEntry.quantityPerGarment.toString(),
      unit: bomEntry.unit,
      unitPrice: bomEntry.unitPrice?.toString(),
      totalCost: bomEntry.totalCost?.toString(),
    },
  });
};

/**
 * Update BOM item
 * PUT /api/styles/:styleId/materials/:bomId
 */
export const updateBOMItem = async (req: Request, res: Response): Promise<void> => {
  const { styleId, bomId } = req.params;
  const { componentName, quantityPerGarment, unit, notes, isActive, extraPercentage } = req.body;

  logDebug(`Updating BOM item: ${bomId} for style ${styleId}`);

  // Verify BOM item exists and belongs to style
  const existing = await prisma.style_material_bom.findFirst({
    where: {
      id: bomId,
      styleId,
    },
  });

  if (!existing) {
    throw new NotFoundError('BOM item', bomId);
  }

  // BUG-STY8 fix: Recalculate total cost using decimal.js for precision
  let totalCost = existing.totalCost;
  if (quantityPerGarment !== undefined) {
    // Use multiplyCurrency for precise calculation, then convert to Prisma.Decimal for storage
    const unitPriceStr = existing.unitPrice?.toString() || '0';
    totalCost = new Prisma.Decimal(multiplyCurrency(quantityPerGarment, unitPriceStr).toFixed(4));
  }

  // Update BOM item
  // BUG-STY8 fix: Use toCurrency + toNumber for safe quantity parsing
  const updated = await prisma.style_material_bom.update({
    where: { id: bomId },
    data: {
      componentName: componentName !== undefined ? componentName : existing.componentName,
      quantityPerGarment:
        quantityPerGarment !== undefined ? toNumber(toCurrency(quantityPerGarment)) : existing.quantityPerGarment,
      unit: unit !== undefined ? unit : existing.unit,
      totalCost,
      notes: notes !== undefined ? notes : existing.notes,
      isActive: isActive !== undefined ? isActive : existing.isActive,
      // `!== undefined` so an explicit 0 is written; `||` would discard it.
      extraPercentage: extraPercentage !== undefined ? extraPercentage : existing.extraPercentage,
    },
  });

  logInfo(`BOM item updated: ${bomId}`);

  res.json({
    message: 'BOM item updated successfully',
    bomEntry: {
      id: updated.id,
      componentName: updated.componentName,
      quantityPerGarment: updated.quantityPerGarment.toString(),
      unit: updated.unit,
      unitPrice: updated.unitPrice?.toString(),
      totalCost: updated.totalCost?.toString(),
      notes: updated.notes,
      isActive: updated.isActive,
    },
  });
};

/**
 * Delete BOM item
 * DELETE /api/styles/:styleId/materials/:bomId
 */
export const deleteBOMItem = async (req: Request, res: Response): Promise<void> => {
  const { styleId, bomId } = req.params;

  logDebug(`Deleting BOM item: ${bomId} from style ${styleId}`);

  // Verify BOM item exists and belongs to style
  const existing = await prisma.style_material_bom.findFirst({
    where: {
      id: bomId,
      styleId,
    },
  });

  if (!existing) {
    throw new NotFoundError('BOM item', bomId);
  }

  // Soft delete by setting isActive = false
  await prisma.style_material_bom.update({
    where: { id: bomId },
    data: {
      isActive: false,
    },
  });

  logInfo(`BOM item deleted (soft): ${bomId}`);

  res.json({
    message: 'BOM item deleted successfully',
  });
};
