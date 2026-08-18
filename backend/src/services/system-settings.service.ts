import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

interface CachedSetting {
  value: string;
  dataType: string;
  expiresAt: number;
}

interface SystemSettingInput {
  value: string;
  dataType?: string;
  category?: string;
  description?: string;
  isSystem?: boolean;
}

interface QueryParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Default settings seeded on startup
const DEFAULT_SETTINGS: Array<{
  key: string;
  value: string;
  dataType: string;
  category: string;
  description: string;
  isSystem: boolean;
}> = [
  {
    key: 'FABRIC_DEFAULT_WASTAGE_PERCENT',
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default wastage % for fabric materials in CAD and BOM',
    isSystem: true,
  },
  {
    key: 'GREIGE_DEFAULT_WASTAGE_PERCENT',
    value: '0',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default wastage % for greige materials in CAD and BOM',
    isSystem: true,
  },
  {
    key: 'LACE_DEFAULT_WASTAGE_PERCENT',
    value: '5',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default wastage % for lace materials',
    isSystem: true,
  },
  // P3.5+ wastage unification: add system settings for trims and thread
  {
    key: 'TRIM_DEFAULT_WASTAGE_PERCENT',
    value: '2',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default wastage % for trim materials (buttons, zippers, elastics, etc.)',
    isSystem: true,
  },
  {
    key: 'THREAD_DEFAULT_COST_PER_GARMENT',
    value: '4',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default thread cost per garment (INR) when not specified in cost sheet',
    isSystem: true,
  },
  {
    key: 'LABEL_DEFAULT_EXTRA_PERCENT',
    value: '5',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Default extra % for label materials',
    isSystem: true,
  },
  {
    // BUG-GR8 fix: This setting is now used in fabric-stock, stock-routing, and fabric controllers.
    // NOTE: the key says _CM but the value IS AND ALWAYS WAS INCHES (historical misnomer). Read it
    // ONLY via systemSettingsService.getCutableWidthDeductionInches() so the key lives in one place.
    key: 'GREIGE_CUTABLE_WIDTH_DEDUCTION_CM',
    value: '2',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description:
      'Selvedge/pin-mark deduction in INCHES: finished width − deduction = cutable width; cutable + deduction = finished width to ask the processor for. (Key name says CM for historical reasons — the value is inches.)',
    isSystem: true,
  },
  {
    key: 'GREIGE_DEFAULT_QUALITY_GRADE',
    value: 'A',
    dataType: 'STRING',
    category: 'DEFAULTS',
    description: 'Default quality grade for greige stock (A, B, C)',
    isSystem: true,
  },
  // BUG-GR9 fix: Centralized quality grade default for all stock types
  {
    key: 'DEFAULT_QUALITY_GRADE',
    value: 'A',
    dataType: 'STRING',
    category: 'DEFAULTS',
    description:
      'Default quality grade for all stock types (A, B, DEFECT). Used when quality grade is not specified during stock creation.',
    isSystem: true,
  },
  {
    key: 'STOCK_AGING_THRESHOLD_DAYS',
    value: '180',
    dataType: 'NUMBER',
    category: 'DEFAULTS',
    description: 'Number of days after which stock is considered aged/old',
    isSystem: true,
  },
  // KAAJ_BUTTON processing rates (outsourced buttonhole + button attachment)
  {
    key: 'KAAJ_BUTTONHOLE_RATE_PER_UNIT',
    value: '0.30',
    dataType: 'NUMBER',
    category: 'PROCESSING_RATES',
    description: 'Default rate per buttonhole (₹) for outsourced kaaj work',
    isSystem: true,
  },
  {
    key: 'KAAJ_BUTTON_RATE_PER_UNIT',
    value: '0.30',
    dataType: 'NUMBER',
    category: 'PROCESSING_RATES',
    description: 'Default rate per button attachment (₹) for outsourced kaaj work',
    isSystem: true,
  },
];

class SystemSettingsService {
  private cache: Map<string, CachedSetting> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a setting by key. Checks cache first, then DB.
   */
  async getByKey(key: string): Promise<{ key: string; value: string; dataType: string } | null> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return { key, value: cached.value, dataType: cached.dataType };
    }

    // Query DB
    const setting = await prisma.system_settings.findUnique({ where: { key } });
    if (!setting) return null;

    // Update cache
    this.cache.set(key, {
      value: setting.value,
      dataType: setting.dataType,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

    return { key: setting.key, value: setting.value, dataType: setting.dataType };
  }

  /**
   * Get a numeric setting with fallback.
   */
  async getNumber(key: string, fallback: number): Promise<number> {
    const setting = await this.getByKey(key);
    if (!setting) return fallback;
    const num = Number(setting.value);
    return isNaN(num) ? fallback : num;
  }

  /**
   * Selvedge/pin-mark deduction (INCHES) converting finished width → cutable width,
   * and cutable → the finished width to ASK a processor for (cutable + deduction).
   * Single source of truth — the stored key is a historical misnomer (says _CM, value
   * has always been inches); keep the key string HERE only so a future rename is one line.
   */
  async getCutableWidthDeductionInches(): Promise<number> {
    return this.getNumber('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM', 2);
  }

  /**
   * Get a string setting with fallback.
   */
  async getString(key: string, fallback: string): Promise<string> {
    const setting = await this.getByKey(key);
    return setting?.value ?? fallback;
  }

  /**
   * BUG-GR9 fix: Get the default quality grade for stock entries.
   * Returns the configured DEFAULT_QUALITY_GRADE or 'A' as fallback.
   * Valid values: 'A', 'B', 'DEFECT'
   */
  async getDefaultQualityGrade(): Promise<'A' | 'B' | 'DEFECT'> {
    const value = await this.getString('DEFAULT_QUALITY_GRADE', 'A');
    // Validate the value is one of the allowed grades
    if (value === 'A' || value === 'B' || value === 'DEFECT') {
      return value;
    }
    return 'A'; // Fallback to 'A' if invalid value configured
  }

  /**
   * List all settings with optional filtering and pagination.
   */
  async getAll(params: QueryParams = {}) {
    const { category, search, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.system_settings.findMany({
        where,
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.system_settings.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all settings in DEFAULTS category (convenience).
   */
  async getDefaults() {
    const settings = await prisma.system_settings.findMany({
      where: { category: 'DEFAULTS' },
      orderBy: { key: 'asc' },
    });

    // Return as key-value map for easy frontend consumption
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  /**
   * Create or update a setting.
   */
  async upsert(key: string, input: SystemSettingInput) {
    const setting = await prisma.system_settings.upsert({
      where: { key },
      create: {
        key,
        value: input.value,
        dataType: input.dataType || 'STRING',
        category: input.category || 'GENERAL',
        description: input.description || null,
        isSystem: input.isSystem || false,
      },
      update: {
        value: input.value,
        ...(input.dataType && { dataType: input.dataType }),
        ...(input.category && { category: input.category }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    // Invalidate cache
    this.invalidateCache(key);

    return setting;
  }

  /**
   * Delete a setting. Blocks deletion of system settings.
   */
  async delete(key: string) {
    const existing = await prisma.system_settings.findUnique({ where: { key } });
    if (!existing) {
      throw new Error(`Setting '${key}' not found`);
    }
    if (existing.isSystem) {
      throw new Error(`Cannot delete system setting '${key}'`);
    }

    await prisma.system_settings.delete({ where: { key } });
    this.invalidateCache(key);
  }

  /**
   * Seed default settings if they don't exist. Called at app startup.
   */
  async preloadDefaults(): Promise<void> {
    let seeded = 0;
    for (const def of DEFAULT_SETTINGS) {
      const existing = await prisma.system_settings.findUnique({ where: { key: def.key } });
      if (!existing) {
        await prisma.system_settings.create({ data: def });
        seeded++;
      }
      // Pre-warm cache
      const setting = existing || def;
      this.cache.set(def.key, {
        value: setting.value,
        dataType: setting.dataType,
        expiresAt: Date.now() + this.CACHE_TTL_MS,
      });
    }
    if (seeded > 0) {
      logInfo(`Seeded ${seeded} default system settings`);
    }
    logInfo(`System settings loaded: ${this.cache.size} cached`);
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }
}

export const systemSettingsService = new SystemSettingsService();
