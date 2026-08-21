import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';
import {
  SYSTEM_DEFAULTS,
  SYSTEM_DEFAULT_ENTRIES,
  type SystemDefaultKey,
  type NumberDefaultKey,
  type StringDefaultKey,
  type BooleanDefaultKey,
} from '../config/defaults.registry';

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

// The seed list IS the registry — see src/config/defaults.registry.ts.
// There is no second copy of these values anywhere.

class SystemSettingsService {
  private cache: Map<string, CachedSetting> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a raw setting row by key. Checks cache first, then DB.
   *
   * Prefer getNumberDefault / getStringDefault / getBooleanDefault — they are typed to the
   * registry and cannot be called with a stray fallback literal. This stays public only for
   * the settings CRUD surface itself.
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
   * Resolve a registered setting: the user's system_settings row if one exists,
   * otherwise the authored value from defaults.registry.ts.
   *
   * NOTE the deliberately missing `fallback` parameter. Callers must never supply a
   * literal — that is exactly how this codebase ended up with the same default
   * declared seven different ways. The value lives in the registry, once.
   */
  private async resolve(key: SystemDefaultKey): Promise<string> {
    const setting = await this.getByKey(key);
    return setting?.value ?? SYSTEM_DEFAULTS[key].value;
  }

  /** Numeric setting. Only accepts keys registered with dataType NUMBER. */
  async getNumberDefault(key: NumberDefaultKey): Promise<number> {
    const raw = await this.resolve(key);
    const num = Number(raw);
    if (isNaN(num)) {
      // A user typed something non-numeric into Settings. Fall back to the authored
      // value rather than poisoning a calculation with NaN.
      logError(`system_settings['${key}'] = '${raw}' is not a number; using registry default`);
      return Number(SYSTEM_DEFAULTS[key].value);
    }
    return num;
  }

  /** String setting. Only accepts keys registered with dataType STRING. */
  async getStringDefault(key: StringDefaultKey): Promise<string> {
    return this.resolve(key);
  }

  /** Boolean setting. Only accepts keys registered with dataType BOOLEAN. */
  async getBooleanDefault(key: BooleanDefaultKey): Promise<boolean> {
    const raw = (await this.resolve(key)).trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  /**
   * Selvedge/pin-mark deduction (INCHES) converting finished width → cutable width,
   * and cutable → the finished width to ASK a processor for (cutable + deduction).
   * The stored key is a historical misnomer (says _CM, value has always been inches);
   * keep the key string HERE only so a future rename is one line.
   */
  async getCutableWidthDeductionInches(): Promise<number> {
    return this.getNumberDefault('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM');
  }

  /**
   * Default quality grade for stock entries. Valid values: 'A', 'B', 'DEFECT'.
   */
  async getDefaultQualityGrade(): Promise<'A' | 'B' | 'DEFECT'> {
    const value = await this.getStringDefault('DEFAULT_QUALITY_GRADE');
    if (value === 'A' || value === 'B' || value === 'DEFECT') {
      return value;
    }
    logError(`system_settings['DEFAULT_QUALITY_GRADE'] = '${value}' is not a valid grade; using 'A'`);
    return 'A';
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
   * Every registered default, as an ARRAY OF ROWS — never a keyed map.
   *
   * This shape is load-bearing. The global response serializer camelizes object KEYS
   * (app.ts → transform middleware → humps.camelizeKeys), which destroys a
   * SCREAMING_SNAKE map key:
   *     { FABRIC_DEFAULT_WASTAGE_PERCENT: '0' }  →  { fABRICDEFAULTWASTAGEPERCENT: '0' }
   * That silently broke every frontend read of a system setting. In a row the key is a
   * VALUE, not an object key, so it survives untouched. Do not "simplify" this back
   * into a map.
   *
   * Rows are driven by the registry, so a key with no DB row still appears (carrying its
   * authored value) and is therefore editable in Settings — which is why
   * TRIM_DEFAULT_WASTAGE_PERCENT used to be invisible in the UI.
   */
  async getDefaults() {
    const rows = await prisma.system_settings.findMany({
      where: { key: { in: SYSTEM_DEFAULT_ENTRIES.map((e) => e.key) } },
    });
    const overrides = new Map(rows.map((r) => [r.key, r]));

    return SYSTEM_DEFAULT_ENTRIES.map((entry) => {
      const override = overrides.get(entry.key);
      return {
        key: entry.key,
        value: override?.value ?? entry.value,
        dataType: entry.dataType,
        category: entry.category,
        group: entry.group,
        label: entry.label,
        description: entry.description,
        min: entry.min ?? null,
        max: entry.max ?? null,
        unit: entry.unit ?? null,
        /** true when a user has overridden the authored default. */
        isOverridden: override != null && override.value !== entry.value,
        registryValue: entry.value,
      };
    });
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
   * Seed any registry key that has no row yet. Called at app startup.
   *
   * INSERT-ONLY BY DESIGN: an existing row is a value the user chose in Settings, and a
   * deploy must never overwrite their choice. Changing a value in defaults.registry.ts
   * therefore only affects installations that have never set that key — to change a live
   * value, edit it in Settings (or run a one-off correction migration).
   */
  async preloadDefaults(): Promise<void> {
    let seeded = 0;
    for (const entry of SYSTEM_DEFAULT_ENTRIES) {
      const existing = await prisma.system_settings.findUnique({ where: { key: entry.key } });
      if (!existing) {
        await prisma.system_settings.create({
          data: {
            key: entry.key,
            value: entry.value,
            dataType: entry.dataType,
            category: entry.category,
            description: entry.description,
            isSystem: true,
          },
        });
        seeded++;
      }
      // Pre-warm the cache from the row we will actually serve. Previously this cached
      // `existing || def`, which meant a stale row kept being served for the process
      // lifetime even after the registry changed.
      this.cache.set(entry.key, {
        value: existing?.value ?? entry.value,
        dataType: entry.dataType,
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
