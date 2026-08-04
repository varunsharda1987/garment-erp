import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateCode } from '../utils/code-generator';
import { NotFoundError, ValidationError } from '../errors';
import { logWarn } from '../utils/logger';
import { materialService } from '../services/material.service';
import { syncMasterToMaterials } from '../services/helpers/material-sync.helper';

/**
 * Generic Trim Controller
 * Handles CRUD operations for all new trim types using configuration
 *
 * BUG-GT5: See genericTrim.schema.ts and frontend/src/types/genericTrim.types.ts
 * for documentation on the intentional generic-backend/typed-frontend architecture.
 */

// Configuration for each trim type
interface TrimConfig {
  model: string;
  codeField: string;
  nameField: string;
  codePrefix: string;
  displayName: string;
  materialType: string;
  defaultUnit: string;
  categoryName: string;
}

const TRIM_CONFIGS: Record<string, TrimConfig> = {
  hook_eye: {
    model: 'hook_eye_master',
    codeField: 'hookEyeCode',
    nameField: 'hookEyeName',
    codePrefix: 'HE',
    displayName: 'Hook & Eye',
    materialType: 'HOOK_EYE',
    defaultUnit: 'PAIR',
    categoryName: 'Accessories',
  },
  snap_button: {
    model: 'snap_button_master',
    codeField: 'snapButtonCode',
    nameField: 'snapButtonName',
    codePrefix: 'SB',
    displayName: 'Snap Button',
    materialType: 'SNAP_BUTTON',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  buckle: {
    model: 'buckle_master',
    codeField: 'buckleCode',
    nameField: 'buckleName',
    codePrefix: 'BK',
    displayName: 'Buckle',
    materialType: 'BUCKLE',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  belt: {
    model: 'belt_master',
    codeField: 'beltCode',
    nameField: 'beltName',
    codePrefix: 'BT',
    displayName: 'Belt',
    materialType: 'BELT',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  velcro: {
    model: 'velcro_master',
    codeField: 'velcroCode',
    nameField: 'velcroName',
    codePrefix: 'VL',
    displayName: 'Velcro',
    materialType: 'VELCRO',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  drawstring: {
    model: 'drawstring_master',
    codeField: 'drawstringCode',
    nameField: 'drawstringName',
    codePrefix: 'DS',
    displayName: 'Drawstring',
    materialType: 'DRAWSTRING',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  ribbon: {
    model: 'ribbon_master',
    codeField: 'ribbonCode',
    nameField: 'ribbonName',
    codePrefix: 'RB',
    displayName: 'Ribbon',
    materialType: 'RIBBON',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  sequin: {
    model: 'sequin_master',
    codeField: 'sequinCode',
    nameField: 'sequinName',
    codePrefix: 'SQ',
    displayName: 'Sequin',
    materialType: 'SEQUIN',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  bead: {
    model: 'bead_master',
    codeField: 'beadCode',
    nameField: 'beadName',
    codePrefix: 'BD',
    displayName: 'Bead',
    materialType: 'BEAD',
    defaultUnit: 'PACK',
    categoryName: 'Accessories',
  },
  motif: {
    model: 'motif_master',
    codeField: 'motifCode',
    nameField: 'motifName',
    codePrefix: 'MT',
    displayName: 'Motif',
    materialType: 'MOTIF',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  interlining: {
    model: 'interlining_master',
    codeField: 'interliningCode',
    nameField: 'interliningName',
    codePrefix: 'IL',
    displayName: 'Interlining',
    materialType: 'INTERLINING',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  padding: {
    model: 'padding_master',
    codeField: 'paddingCode',
    nameField: 'paddingName',
    codePrefix: 'PD',
    displayName: 'Padding',
    materialType: 'PADDING',
    defaultUnit: 'PAIR',
    categoryName: 'Accessories',
  },
  // "Others" categories - for miscellaneous items in each category
  other_fastener: {
    model: 'other_fastener_master',
    codeField: 'otherFastenerCode',
    nameField: 'otherFastenerName',
    codePrefix: 'OF',
    displayName: 'Other Fastener',
    materialType: 'OTHER_FASTENER',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  other_tape: {
    model: 'other_tape_master',
    codeField: 'otherTapeCode',
    nameField: 'otherTapeName',
    codePrefix: 'OT',
    displayName: 'Other Tape/Thread',
    materialType: 'OTHER_TAPE',
    defaultUnit: 'METER',
    categoryName: 'Accessories',
  },
  other_decorative: {
    model: 'other_decorative_master',
    codeField: 'otherDecorativeCode',
    nameField: 'otherDecorativeName',
    codePrefix: 'OD',
    displayName: 'Other Decorative',
    materialType: 'OTHER_DECORATIVE',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
  other_functional: {
    model: 'other_functional_master',
    codeField: 'otherFunctionalCode',
    nameField: 'otherFunctionalName',
    codePrefix: 'OX',
    displayName: 'Other Functional',
    materialType: 'OTHER_FUNCTIONAL',
    defaultUnit: 'PIECE',
    categoryName: 'Accessories',
  },
};

// Mapping from trim type key to FK field name on materials/style_material_bom tables
const TRIM_TYPE_FK_MAP: Record<string, string> = {
  hook_eye: 'hookEyeId',
  snap_button: 'snapButtonId',
  buckle: 'buckleId',
  belt: 'beltId',
  velcro: 'velcroId',
  drawstring: 'drawstringId',
  ribbon: 'ribbonId',
  sequin: 'sequinId',
  bead: 'beadId',
  motif: 'motifId',
  interlining: 'interliningId',
  padding: 'paddingId',
  other_fastener: 'otherFastenerId',
  other_tape: 'otherTapeId',
  other_decorative: 'otherDecorativeId',
  other_functional: 'otherFunctionalId',
};

// Helper to get Prisma model dynamically
const getPrismaModel = (modelName: string) => {
  return (prisma as any)[modelName];
};

/**
 * Get all items for a trim type with pagination
 */
export const getAll = async (req: Request, res: Response) => {
  const { trimType } = req.params;
  const config = TRIM_CONFIGS[trimType];

  if (!config) {
    throw new ValidationError(`Invalid trim type: ${trimType}`);
  }

  const { page = 1, limit = 10, search = '', isActive } = (req as any).validatedQuery || req.query;

  const pageNum = Number(page) || 1;
  const limitNum = Math.max(1, Number(limit) || 10);
  const offset = (pageNum - 1) * limitNum;

  const model = getPrismaModel(config.model);

  // Build where clause
  const where: any = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (search) {
    where.OR = [
      { [config.nameField]: { contains: String(search), mode: 'insensitive' } },
      { [config.codeField]: { contains: String(search), mode: 'insensitive' } },
      { color: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    model.count({ where }),
    model.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum,
    }),
  ]);

  res.json({
    data: items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get item by ID
 */
export const getById = async (req: Request, res: Response) => {
  const { trimType, id } = req.params;
  const config = TRIM_CONFIGS[trimType];

  if (!config) {
    throw new ValidationError(`Invalid trim type: ${trimType}`);
  }

  const model = getPrismaModel(config.model);

  const item = await model.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!item) {
    throw new NotFoundError(config.displayName, id);
  }

  res.json(item);
};

/**
 * Create new item
 */
export const createGenericTrim = async (req: Request, res: Response) => {
  const { trimType } = req.params;
  const config = TRIM_CONFIGS[trimType];

  if (!config) {
    throw new ValidationError(`Invalid trim type: ${trimType}`);
  }

  const { [config.nameField]: name, ...otherData } = req.body;

  // Generate code
  const code = await generateCode(config.codePrefix, config.model, config.codeField);

  // Auto-generate name if not provided
  let finalName = name;
  if (!finalName || finalName.trim() === '') {
    const parts = [];

    // Try to build name from common fields
    if (otherData.color) parts.push(otherData.color);
    if (otherData.material) parts.push(otherData.material);
    if (otherData.width) parts.push(otherData.width);
    if (otherData.size) parts.push(otherData.size);

    // Add display name
    parts.push(config.displayName);

    // Fallback to code
    finalName = parts.join(' ').trim() || `${config.displayName} ${code}`;
  }

  // Get user ID from auth (optional)
  const userId = req.user?.userId || null;

  const fkField = TRIM_TYPE_FK_MAP[trimType];

  // Create the item + its material entry atomically (same pattern as button.controller.ts) so a
  // failure cannot leave a master without its materials record
  const item = await prisma.$transaction(async (tx) => {
    const created = await (tx as any)[config.model].create({
      data: {
        [config.codeField]: code,
        [config.nameField]: finalName.trim(),
        ...otherData,
        createdById: userId,
        isActive: true,
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (fkField) {
      // Create material (same-id convention, category auto-resolved)
      await materialService.createFromMaster({ id: created.id, code, name: finalName.trim() }, config.materialType, tx);
    }

    return created;
  });

  res.status(201).json({
    data: item,
    message: `${config.displayName} created successfully`,
  });
};

/**
 * Update item
 */
export const update = async (req: Request, res: Response) => {
  const { trimType, id } = req.params;
  const config = TRIM_CONFIGS[trimType];

  if (!config) {
    throw new ValidationError(`Invalid trim type: ${trimType}`);
  }

  const model = getPrismaModel(config.model);

  // Check if exists
  const existing = await model.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(config.displayName, id);
  }

  // Don't allow changing the code
  const { [config.codeField]: _, ...updateData } = req.body;

  const updated = await model.update({
    where: { id },
    data: updateData,
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  // Sync materials record if name or isActive changed (canonical helper)
  const fkField = TRIM_TYPE_FK_MAP[trimType];
  if (fkField) {
    const newName = updateData[config.nameField] as string | undefined;
    const newIsActive = updateData.isActive as boolean | undefined;

    // Only call if something changed
    if (newName !== undefined || newIsActive !== undefined) {
      await syncMasterToMaterials(id, config.materialType, {
        name: newName?.trim(),
        isActive: newIsActive,
      });
    }
  }

  res.json({
    data: updated,
    message: `${config.displayName} updated successfully`,
  });
};

/**
 * Delete item (soft delete by setting isActive to false)
 */
export const remove = async (req: Request, res: Response) => {
  const { trimType, id } = req.params;
  const config = TRIM_CONFIGS[trimType];

  if (!config) {
    throw new ValidationError(`Invalid trim type: ${trimType}`);
  }

  const model = getPrismaModel(config.model);

  // Check if exists
  const existing = await model.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(config.displayName, id);
  }

  // Soft delete trim master
  await model.update({
    where: { id },
    data: { isActive: false },
  });

  // Also deactivate the corresponding materials record
  const fkField = TRIM_TYPE_FK_MAP[trimType];
  if (fkField) {
    await prisma.materials.updateMany({
      where: { [fkField]: id },
      data: { isActive: false },
    });
  }

  res.json({ message: `${config.displayName} deleted successfully` });
};

/**
 * Get all trim configs (for frontend to know available types)
 */
export const getConfigs = async (_req: Request, res: Response) => {
  const configs = Object.entries(TRIM_CONFIGS).map(([key, config]) => ({
    type: key,
    displayName: config.displayName,
    codePrefix: config.codePrefix,
    defaultUnit: config.defaultUnit,
    materialType: config.materialType,
  }));

  res.json(configs);
};

/**
 * Get count for each trim type (for dashboard)
 */
export const getCounts = async (_req: Request, res: Response) => {
  const counts: Record<string, number> = {};

  for (const [key, config] of Object.entries(TRIM_CONFIGS)) {
    try {
      const model = getPrismaModel(config.model);
      counts[key] = await model.count({ where: { isActive: true } });
    } catch (err: any) {
      // If table doesn't exist (P2021), set count to 0 and continue
      // This is business logic - keep inner try-catch for per-type error handling
      if (err.code === 'P2021') {
        logWarn(`Table ${config.model} does not exist, skipping count for ${key}`);
        counts[key] = 0;
      } else {
        throw err; // Re-throw other errors
      }
    }
  }

  res.json(counts);
};
