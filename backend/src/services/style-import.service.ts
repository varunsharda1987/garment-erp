// Style Import Service
// Handles bulk import of styles with fabrics from CSV
// Updated to support new simplified import format with master lookups

import { Gender, Prisma, ProcessType } from '@prisma/client';
import prisma from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';
import {
  StyleImportRow,
  StyleImportCSVRow,
  StyleImportResponse,
  ImportSummary,
  StyleImportError,
  FabricToCreate,
  StyleToCreate,
  ComponentToCreate,
  CustomerLookupResult,
  BrandCategoryLookupResult,
  StyleCategoryLookupResult,
  STYLE_IMPORT_VALIDATION_RULES,
} from '../types/style-import.types';
import StyleVariantService from './style-variant.service';
import { StyleVariantData } from '../types/style-variant.types';
import { randomUUID } from 'crypto';
import { SeasonService } from './season.service';

// Size ordering for standard garment sizes
const SIZE_ORDER: Record<string, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
  XXL: 5,
  XXXL: 6,
  '2XL': 5,
  '3XL': 6,
  '4XL': 7,
  '5XL': 8,
  // Kids numeric sizes
  '2Y': 10,
  '3Y': 11,
  '4Y': 12,
  '5Y': 13,
  '6Y': 14,
  '7Y': 15,
  '8Y': 16,
  '9Y': 17,
  '10Y': 18,
  '11Y': 19,
  '12Y': 20,
  '14Y': 21,
  '16Y': 22,
  // Free size
  FREE: 50,
  'FREE SIZE': 50,
  FREESIZE: 50,
};

export class StyleImportService {
  /**
   * Generate internal style code in format STY-YYYYMM-XXXX
   * e.g., STY-202506-0001, STY-202506-0002, etc.
   */
  private async generateInternalCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `STY-${yearMonth}-`;

    // Find the highest existing code for this month
    const lastStyle = await prisma.styles.findFirst({
      where: {
        internalCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        internalCode: 'desc',
      },
      select: {
        internalCode: true,
      },
    });

    let nextNumber = 1;
    if (lastStyle?.internalCode) {
      const lastNumber = parseInt(lastStyle.internalCode.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Generate SKU from styleCode and size
   * Pattern: {styleCode}{size} with special chars removed
   */
  private generateSKU(styleCode: string, size: string): string {
    const cleanStyleCode = styleCode.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const cleanSize = size.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return `${cleanStyleCode}${cleanSize}`;
  }

  /**
   * Get size sort order
   */
  private getSizeOrder(size: string): number {
    const upperSize = size.toUpperCase().trim();
    return SIZE_ORDER[upperSize] ?? 100; // Default to 100 for unknown sizes
  }

  // =====================================================
  // Master Lookup Methods
  // =====================================================

  /**
   * Lookup customer by name (case-insensitive)
   * Returns null if not found - customer MUST exist
   */
  private async lookupCustomer(customerName: string): Promise<CustomerLookupResult | null> {
    const customer = await prisma.customers.findFirst({
      where: {
        name: {
          equals: customerName.trim(),
          mode: 'insensitive',
        },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    return customer;
  }

  /**
   * Find or create brand category for a customer
   * Creates new brand_categories record if not found
   */
  private async findOrCreateBrandCategory(
    customerId: string,
    brandName: string,
    category?: string,
    subCategory?: string,
    subSubCategory?: string
  ): Promise<BrandCategoryLookupResult> {
    // First try to find exact match
    const existing = await prisma.brand_categories.findFirst({
      where: {
        customerId,
        brandName: {
          equals: brandName.trim(),
          mode: 'insensitive',
        },
        ...(category
          ? {
              category: {
                equals: category.trim(),
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(subCategory
          ? {
              subCategory: {
                equals: subCategory.trim(),
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(subSubCategory
          ? {
              subSubCategory: {
                equals: subSubCategory.trim(),
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
    });

    if (existing) {
      return {
        id: existing.id,
        customerId: existing.customerId,
        brandName: existing.brandName,
        category: existing.category,
        subCategory: existing.subCategory,
        subSubCategory: existing.subSubCategory,
      };
    }

    // Create new brand category
    // Note: category is required in schema, so we use a default if not provided
    const created = await prisma.brand_categories.create({
      data: {
        id: randomUUID(),
        customerId,
        brandName: brandName.trim(),
        category: category?.trim() || 'General', // Default category if not provided
        ...(subCategory ? { subCategory: subCategory.trim() } : {}),
        ...(subSubCategory ? { subSubCategory: subSubCategory.trim() } : {}),
        createdAt: new Date(),
      },
    });

    logInfo(`Created new brand category: ${brandName} for customer ${customerId}`);

    return {
      id: created.id,
      customerId: created.customerId,
      brandName: created.brandName,
      category: created.category ?? null,
      subCategory: created.subCategory ?? null,
      subSubCategory: created.subSubCategory ?? null,
    };
  }

  /**
   * Find or create internal style category (global, not buyer-specific)
   */
  private async findOrCreateStyleCategory(categoryName: string): Promise<StyleCategoryLookupResult> {
    // First try to find existing
    const existing = await prisma.style_categories.findFirst({
      where: {
        name: {
          equals: categoryName.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
      };
    }

    // Create new category
    const created = await prisma.style_categories.create({
      data: {
        id: randomUUID(),
        name: categoryName.trim(),
        createdAt: new Date(),
      },
    });

    logInfo(`Created new style category: ${categoryName}`);

    return {
      id: created.id,
      name: created.name,
    };
  }

  /**
   * Main import function - processes CSV data and creates records
   */
  async importStylesFromCSV(
    csvRows: StyleImportCSVRow[],
    importBatchId: string,
    userId: string,
    options?: {
      overwriteExisting?: boolean;
      skipDuplicates?: boolean;
    }
  ): Promise<StyleImportResponse> {
    const startTime = Date.now();
    const summary: ImportSummary = {
      totalRows: csvRows.length,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      stylesCreated: 0,
      stylesUpdated: 0,
      componentsCreated: 0,
      fabricsCreated: 0,
      cadEntriesCreated: 0,
      variantsCreated: 0,
      processingTimeMs: 0,
    };
    const errors: StyleImportError[] = [];

    try {
      // Step 1: Validate and parse CSV rows
      const { validRows, invalidRows } = await this.validateAndParseRows(csvRows, importBatchId);

      // Add validation errors to the errors array
      invalidRows.forEach((row, index) => {
        errors.push({
          rowNumber: index + 1,
          styleCode: row.styleCode || 'Unknown',
          componentName: row.componentName || '',
          fabricDescription: row.fabricDescription || '',
          errorMessage: row.validationErrors.join('; '),
          errorType: 'VALIDATION',
        });
      });
      summary.errorCount += invalidRows.length;

      // Step 2: Group rows by style code
      const styleGroups = this.groupRowsByStyle(validRows);

      // Step 3: Process each style
      for (const [styleCode, rows] of Object.entries(styleGroups)) {
        try {
          const firstRow = rows[0];

          // Check if style exists
          const existingStyle = await prisma.styles.findFirst({
            where: { styleCode, isActive: true },
          });

          if (existingStyle && !options?.overwriteExisting) {
            if (options?.skipDuplicates) {
              // Skip this style - count as skipped
              summary.skippedCount += rows.length;
              await this.updateStagingRecords(rows, 'SKIPPED');
              continue;
            } else {
              // Report error
              errors.push({
                rowNumber: 0,
                styleCode,
                componentName: '',
                fabricDescription: '',
                errorMessage: `Style ${styleCode} already exists. Set overwriteExisting=true to update.`,
                errorType: 'BUSINESS_LOGIC',
              });
              summary.errorCount += rows.length;
              continue;
            }
          }

          // Create or update style
          const style = await this.createOrUpdateStyle(firstRow, rows, userId, existingStyle ? true : false);

          if (existingStyle) {
            summary.stylesUpdated++;
          } else {
            summary.stylesCreated++;
          }

          // Process size variants (simplified - no components/fabrics/CAD/workflow)
          const variantCount = await this.processStyleVariants(style.id, styleCode, rows);
          summary.variantsCreated += variantCount;

          summary.successCount += rows.length;

          // Update staging table
          await this.updateStagingRecords(rows, 'PROCESSED', style.id);
        } catch (error: unknown) {
          // Handle errors for this style
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logError(`Error processing style ${styleCode}:`, error);
          errors.push({
            rowNumber: 0,
            styleCode,
            componentName: '',
            fabricDescription: '',
            errorMessage,
            errorType: 'DATABASE',
          });
          summary.errorCount += rows.length;

          // Update staging table with error
          await this.updateStagingRecords(rows, 'ERROR', undefined, errorMessage);
        }
      }

      summary.processingTimeMs = Date.now() - startTime;

      return {
        success: summary.errorCount === 0,
        importBatchId,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: unknown) {
      logError('Style import failed:', error);
      throw new Error(`Style import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and parse CSV rows, insert into staging table
   * Updated to support new simplified import format with master lookups
   */
  private async validateAndParseRows(
    csvRows: StyleImportCSVRow[],
    importBatchId: string
  ): Promise<{ validRows: StyleImportRow[]; invalidRows: StyleImportRow[] }> {
    const validatedRows: StyleImportRow[] = [];

    // Cache for customer lookups to avoid repeated DB calls
    const customerCache = new Map<string, CustomerLookupResult | null>();

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const validationErrors: string[] = [];

      // Normalize field values (support legacy field names)
      const customerName = (row.customerName || row.customer || '').trim();
      const brandName = (row.brandName || row.brand || '').trim();
      const size = (row.size || '').trim();
      const styleCode = (row.styleCode || '').trim();

      // Run validation rules
      for (const rule of STYLE_IMPORT_VALIDATION_RULES) {
        const rowRecord: Record<string, unknown> = {
          ...row,
          customerName,
          brandName,
          size,
        };
        const fieldValue = rowRecord[rule.field];
        if (!rule.validate(fieldValue, rowRecord)) {
          validationErrors.push(rule.message);
        }
      }

      // Validate customer exists in master (only if basic validation passed)
      let customerId: string | undefined;
      if (customerName && validationErrors.length === 0) {
        // Check cache first
        if (!customerCache.has(customerName.toLowerCase())) {
          const customer = await this.lookupCustomer(customerName);
          customerCache.set(customerName.toLowerCase(), customer);
        }

        const cachedCustomer = customerCache.get(customerName.toLowerCase());
        if (!cachedCustomer) {
          validationErrors.push(`Customer "${customerName}" not found in master. Please create the customer first.`);
        } else {
          customerId = cachedCustomer.id;
        }
      }

      // Parse gender enum - map to Prisma enum values
      let gender: Gender | undefined;
      if (row.gender && typeof row.gender === 'string') {
        const genderUpper = row.gender.toUpperCase();
        if (genderUpper === 'MALE' || genderUpper === 'MEN') {
          gender = 'MEN' as Gender;
        } else if (genderUpper === 'FEMALE' || genderUpper === 'WOMEN') {
          gender = 'WOMEN' as Gender;
        } else if (genderUpper === 'KIDS') {
          gender = 'KIDS' as Gender;
        } else if (genderUpper === 'UNISEX') {
          gender = 'UNISEX' as Gender;
        }
      }

      // Generate SKU from styleCode + size
      const sku = this.generateSKU(styleCode, size);

      // Use default values for optional fields
      const styleName = (row.styleName || row.itemDescription || styleCode).trim();

      // Legacy field handling
      const cadAverage = typeof row.cadAverage === 'string' ? parseFloat(row.cadAverage) : row.cadAverage;
      const lastProductionAverage =
        typeof row.lastProductionAverage === 'string'
          ? parseFloat(row.lastProductionAverage)
          : row.lastProductionAverage;
      const fabricWidth = typeof row.fabricWidth === 'string' ? parseFloat(row.fabricWidth) : row.fabricWidth;
      const componentName = (row.componentName || 'Main Component').trim();
      const fabricDescription = (row.fabricDescription || 'Fabric Not Specified').trim();
      const generatedFabricCode = this.generateFabricCode(styleCode, componentName, 1);
      const generatedFabricName = this.generateFabricName(fabricDescription, styleCode, componentName);

      const validatedRow: StyleImportRow = {
        // Required fields
        styleCode,
        customerName,
        brandName,
        size,

        // Optional fields
        styleName,
        season: row.season?.trim(),
        gender,
        buyerCategory: row.buyerCategory?.trim(),
        buyerSubCategory: row.buyerSubCategory?.trim(),
        buyerSubSubCategory: row.buyerSubSubCategory?.trim(),
        internalCategory: row.internalCategory?.trim(),

        // Resolved IDs
        customerId,

        // Generated fields
        sku,
        barcode: sku, // Same as SKU

        // Legacy fields
        projectGroup: row.projectGroup?.trim(),
        itemDescription: row.itemDescription?.trim(),
        customer: row.customer?.trim(),
        category: row.category?.trim(),
        componentName,
        fabricDescription,
        cadAverage,
        lastProductionAverage,
        fabricWidth,
        generatedFabricCode,
        generatedFabricName,

        // Validation status
        isValid: validationErrors.length === 0,
        validationErrors,
      };

      validatedRows.push(validatedRow);

      // Insert into staging table
      await prisma.style_import_staging.create({
        data: {
          styleCode: styleCode || '',
          projectGroup: row.projectGroup,
          itemDescription: styleName,
          customer: customerName,
          season: row.season,
          gender: row.gender,
          category: row.buyerCategory || row.category,
          componentName: componentName,
          fabricDescription: fabricDescription,
          cadAverage: cadAverage ? new Prisma.Decimal(cadAverage) : null,
          lastProductionAverage: lastProductionAverage ? new Prisma.Decimal(lastProductionAverage) : null,
          fabricWidth: fabricWidth ? new Prisma.Decimal(fabricWidth) : null,
          generatedFabricCode,
          generatedFabricName,
          importBatchId,
          status: validationErrors.length > 0 ? 'ERROR' : 'PENDING',
          errorMessage: validationErrors.length > 0 ? validationErrors.join('; ') : null,
        },
      });
    }

    // Separate valid and invalid rows
    const validRows = validatedRows.filter((row) => row.isValid);
    const invalidRows = validatedRows.filter((row) => !row.isValid);

    return { validRows, invalidRows };
  }

  /**
   * Group rows by style code
   */
  private groupRowsByStyle(rows: StyleImportRow[]): Record<string, StyleImportRow[]> {
    return rows.reduce(
      (groups, row) => {
        if (!groups[row.styleCode]) {
          groups[row.styleCode] = [];
        }
        groups[row.styleCode].push(row);
        return groups;
      },
      {} as Record<string, StyleImportRow[]>
    );
  }

  /**
   * Create or update style record
   * Updated to handle brand categories and internal categories
   */
  private async createOrUpdateStyle(
    row: StyleImportRow,
    rows: StyleImportRow[], // All rows for this style (to get unique sizes)
    userId: string,
    isUpdate: boolean
  ) {
    // Get customer ID (already validated)
    const customerId = row.customerId;

    // Find or create brand category if brand name is provided
    let brandCategoryId: string | undefined;
    if (row.brandName && customerId) {
      const brandCategory = await this.findOrCreateBrandCategory(
        customerId,
        row.brandName,
        row.buyerCategory,
        row.buyerSubCategory,
        row.buyerSubSubCategory
      );
      brandCategoryId = brandCategory.id;
    }

    // Find or create internal category if provided
    let categoryId: string | undefined;
    if (row.internalCategory) {
      const styleCategory = await this.findOrCreateStyleCategory(row.internalCategory);
      categoryId = styleCategory.id;
    }

    // Find or create season if provided
    let seasonId: string | null = null;
    if (row.season) {
      // SeasonService is already a singleton instance, not a class
      const season = await SeasonService.findOrCreateByPattern(row.season);
      if (season) {
        seasonId = season.id;
      }
    }

    const styleData = {
      styleCode: row.styleCode,
      styleName: row.styleName || row.itemDescription || row.styleCode,
      customerName: row.customerName,
      brandName: row.brandName,
      brandCategoryId: brandCategoryId || null,
      categoryId: categoryId || null,
      projectGroup: row.projectGroup,
      season: row.season,
      seasonId: seasonId,
      gender: row.gender || ('UNISEX' as Gender),
      description: row.buyerCategory || row.category,
      isActive: true,
      createdById: userId,
    };

    if (isUpdate) {
      // For update, need to find by ID not styleCode
      const existingStyle = await prisma.styles.findFirst({
        where: { styleCode: row.styleCode, isActive: true },
      });
      if (!existingStyle) {
        throw new Error(`Style not found: ${row.styleCode}`);
      }
      return await prisma.styles.update({
        where: { id: existingStyle.id },
        data: styleData,
      });
    } else {
      // Generate internal code for new styles
      const internalCode = await this.generateInternalCode();

      return await prisma.styles.create({
        data: {
          ...styleData,
          id: randomUUID(),
          internalCode,
          createdAt: new Date(),
        },
      });
    }
  }

  /**
   * Process components and fabrics for a style
   */
  private async processComponentsAndFabrics(
    styleId: string,
    styleCode: string,
    rows: StyleImportRow[],
    userId: string
  ) {
    let componentsCreated = 0;
    let fabricsCreated = 0;
    let cadEntriesCreated = 0;

    // Group rows by component
    const componentGroups = rows.reduce(
      (groups, row) => {
        const compName = row.componentName || 'Main Component';
        if (!groups[compName]) {
          groups[compName] = [];
        }
        groups[compName].push(row);
        return groups;
      },
      {} as Record<string, StyleImportRow[]>
    );

    // Process each component
    for (const [componentName, componentRows] of Object.entries(componentGroups)) {
      // Create component
      const component = await prisma.style_components.create({
        data: {
          id: `${styleId}-${componentName}-${Date.now()}`,
          styleId,
          componentName,
          componentType: this.getComponentType(componentName),
          sortOrder: componentsCreated + 1,
          createdAt: new Date(),
        },
      });
      componentsCreated++;

      // Check for duplicate fabrics within the same component
      const uniqueFabrics = new Map<string, StyleImportRow>();
      for (const row of componentRows) {
        // Use fabric description as key for deduplication
        const fabricDesc = row.fabricDescription || 'Default Fabric';
        if (!uniqueFabrics.has(fabricDesc)) {
          uniqueFabrics.set(fabricDesc, row);
        }
      }

      // Create fabrics
      let fabricSequence = 1;
      for (const row of uniqueFabrics.values()) {
        try {
          // Get greige by name or create generic greige
          const csvRow = row as unknown as Record<string, unknown>;
          const fabricDesc = row.fabricDescription || 'Default Fabric';
          const greigeName = (csvRow.greigeName as string) || fabricDesc;
          const greigeId = await this.lookupOrCreateGreige(greigeName, userId);

          // Generate fabric code
          const fabricCode = this.generateFabricCode(styleCode, componentName, fabricSequence);
          const fabricName = this.generateFabricName(fabricDesc, styleCode, componentName);

          // Create fabric
          const fabric = await prisma.fabric_master.create({
            data: {
              id: `${fabricCode}-${Date.now()}`,
              fabricCode,
              fabricName,
              greigeId,
              description: fabricDesc,
              actualWidth: row.fabricWidth ? new Prisma.Decimal(row.fabricWidth) : new Prisma.Decimal(58), // Default 58 inches
              styleReference: styleCode,
              isGeneric: false,
              isActive: true,
              createdById: userId,
              createdAt: new Date(),
            },
          });
          fabricsCreated++;
          fabricSequence++;

          // Create CAD entry
          if (row.fabricWidth) {
            const cadVariancePercent =
              row.cadAverage && row.lastProductionAverage
                ? ((row.lastProductionAverage - row.cadAverage) / row.cadAverage) * 100
                : null;

            await prisma.fabric_width_cad.create({
              data: {
                id: `${fabric.id}-CAD-${Date.now()}`,
                fabricId: fabric.id,
                cutableWidth: new Prisma.Decimal(row.fabricWidth),
                cadMeters: row.cadAverage ? new Prisma.Decimal(row.cadAverage) : null,
                actualCad: row.lastProductionAverage ? new Prisma.Decimal(row.lastProductionAverage) : null,
                cadVariancePercent: cadVariancePercent ? new Prisma.Decimal(cadVariancePercent) : null,
                cadWastagePercent: new Prisma.Decimal(5), // Default 5%
                isPreferred: true, // Mark as preferred width
                createdById: userId,
                createdAt: new Date(),
              },
            });
            cadEntriesCreated++;
          }

          // Link fabric to component via style_fabrics
          await prisma.style_fabrics.create({
            data: {
              id: `${component.id}-${fabric.id}-${Date.now()}`,
              componentId: component.id,
              fabricId: fabric.id,
              fabricCADId: null, // Will be populated when CAD is selected
              quantityNeeded: row.cadAverage ? new Prisma.Decimal(row.cadAverage) : null,
            },
          });
        } catch (error: unknown) {
          logError(`Error creating fabric for ${componentName}:`, error);
          // Continue with next fabric
        }
      }
    }

    return { componentsCreated, fabricsCreated, cadEntriesCreated };
  }

  /**
   * Lookup greige by name or create generic greige
   */
  private async lookupOrCreateGreige(greigeName: string, userId: string): Promise<string> {
    // Try to find existing greige by exact name first
    let existing = await prisma.greige_master.findFirst({
      where: {
        greigeName: {
          equals: greigeName,
          mode: 'insensitive',
        },
      },
    });

    // If not found, try partial match
    if (!existing) {
      existing = await prisma.greige_master.findFirst({
        where: {
          greigeName: {
            contains: greigeName,
            mode: 'insensitive',
          },
        },
      });
    }

    if (existing) {
      return existing.id;
    }

    // Create new greige
    const greigeCode = `GRG-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    const greige = await prisma.greige_master.create({
      data: {
        id: `${greigeCode}-${Date.now()}`,
        greigeCode,
        greigeName: greigeName,
        composition: 'To be specified', // Will be updated later
        greigeWidth: new Prisma.Decimal(58), // Default 58 inches
        isActive: true,
        createdById: userId,
        createdAt: new Date(),
      },
    });

    return greige.id;
  }

  /**
   * Lookup supplier by name (case-insensitive, exact match preferred, then partial)
   * Returns supplier ID if found, null otherwise
   */
  private async lookupSupplierByName(vendorName?: string): Promise<string | null> {
    if (!vendorName || !vendorName.trim()) return null;

    const normalizedName = vendorName.trim();

    // Try exact match first (case-insensitive)
    let supplier = await prisma.suppliers.findFirst({
      where: {
        name: { equals: normalizedName, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true },
    });

    if (supplier) return supplier.id;

    // Try partial match (contains)
    supplier = await prisma.suppliers.findFirst({
      where: {
        name: { contains: normalizedName, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true },
    });

    return supplier?.id || null;
  }

  /**
   * Process production workflow and create style_processes records
   */
  private async processProductionWorkflow(styleId: string, row: StyleImportRow): Promise<number> {
    let processesCreated = 0;
    const csvRow = row as any; // Access original CSV columns

    // Helper to check if a process is enabled in CSV (Yes/Y/True/1)
    const isProcessEnabled = (value?: string): boolean => {
      if (!value) return false;
      const val = value.toString().trim().toUpperCase();
      return val === 'YES' || val === 'Y' || val === 'TRUE' || val === '1';
    };

    // Lookup suppliers for each process type (parallel for efficiency)
    const [printingSupplierId, dyeingSupplierId, embroiderySupplierId, washingSupplierId] = await Promise.all([
      this.lookupSupplierByName(csvRow.printingVendor),
      this.lookupSupplierByName(csvRow.dyeingVendor),
      this.lookupSupplierByName(csvRow.embroideryVendor),
      this.lookupSupplierByName(csvRow.washingVendor),
    ]);

    // Define process order for workflow
    const processOrder: Record<ProcessType, number> = {
      [ProcessType.PRINTING]: 1,
      [ProcessType.DYEING]: 2,
      [ProcessType.EMBROIDERY]: 3,
      [ProcessType.CUTTING]: 4,
      [ProcessType.STITCHING]: 5,
      [ProcessType.FINISHING]: 6,
      [ProcessType.WASHING]: 7,
      [ProcessType.TRANSPORTATION]: 8,
      [ProcessType.HANDWORK]: 9,
      [ProcessType.SMOCKING]: 10,
    };

    // 1. PRINTING (Optional)
    if (isProcessEnabled(csvRow.printing)) {
      await prisma.style_processes.create({
        data: {
          id: randomUUID(),
          styleId,
          processName: 'Printing',
          processType: ProcessType.PRINTING,
          isRequired: false,
          sortOrder: processOrder[ProcessType.PRINTING],
          supplierId: printingSupplierId,
          notes:
            csvRow.printingVendor && !printingSupplierId
              ? `Vendor: ${csvRow.printingVendor}${csvRow.printingDetails ? ` | ${csvRow.printingDetails}` : ''}`
              : csvRow.printingDetails || null,
          createdAt: new Date(),
        },
      });
      processesCreated++;
    }

    // 2. DYEING (Optional)
    if (isProcessEnabled(csvRow.dyeing)) {
      const dyeingNotes = [csvRow.dyeingColor ? `Color: ${csvRow.dyeingColor}` : null].filter(Boolean).join(' | ');

      await prisma.style_processes.create({
        data: {
          id: randomUUID(),
          styleId,
          processName: 'Dyeing',
          processType: ProcessType.DYEING,
          isRequired: false,
          sortOrder: processOrder[ProcessType.DYEING],
          supplierId: dyeingSupplierId,
          notes:
            csvRow.dyeingVendor && !dyeingSupplierId
              ? `Vendor: ${csvRow.dyeingVendor}${dyeingNotes ? ` | ${dyeingNotes}` : ''}`
              : dyeingNotes || null,
          createdAt: new Date(),
        },
      });
      processesCreated++;
    }

    // 3. EMBROIDERY (Optional - can be on fabric)
    if (isProcessEnabled(csvRow.embroidery)) {
      await prisma.style_processes.create({
        data: {
          id: randomUUID(),
          styleId,
          processName: 'Embroidery',
          processType: ProcessType.EMBROIDERY,
          isRequired: false,
          sortOrder: processOrder[ProcessType.EMBROIDERY],
          supplierId: embroiderySupplierId,
          notes:
            csvRow.embroideryVendor && !embroiderySupplierId
              ? `Vendor: ${csvRow.embroideryVendor}${csvRow.embroideryDetails ? ` | ${csvRow.embroideryDetails}` : ''}`
              : csvRow.embroideryDetails || null,
          createdAt: new Date(),
        },
      });
      processesCreated++;
    }

    // 4. CUTTING (Mandatory - always created)
    await prisma.style_processes.create({
      data: {
        id: randomUUID(),
        styleId,
        processName: 'Cutting',
        processType: ProcessType.CUTTING,
        isRequired: true,
        sortOrder: processOrder[ProcessType.CUTTING],
        createdAt: new Date(),
      },
    });
    processesCreated++;

    // 5. STITCHING (Mandatory - always created)
    await prisma.style_processes.create({
      data: {
        id: randomUUID(),
        styleId,
        processName: 'Stitching',
        processType: ProcessType.STITCHING,
        isRequired: true,
        sortOrder: processOrder[ProcessType.STITCHING],
        createdAt: new Date(),
      },
    });
    processesCreated++;

    // 6. FINISHING (Mandatory - always created)
    await prisma.style_processes.create({
      data: {
        id: randomUUID(),
        styleId,
        processName: 'Garment Finishing',
        processType: ProcessType.FINISHING,
        isRequired: true,
        sortOrder: processOrder[ProcessType.FINISHING],
        createdAt: new Date(),
      },
    });
    processesCreated++;

    // 7. WASHING (Optional)
    if (isProcessEnabled(csvRow.washing)) {
      const washingNotes = [csvRow.washType ? `Wash Type: ${csvRow.washType}` : null].filter(Boolean).join(' | ');

      await prisma.style_processes.create({
        data: {
          id: randomUUID(),
          styleId,
          processName: 'Washing',
          processType: ProcessType.WASHING,
          isRequired: false,
          sortOrder: processOrder[ProcessType.WASHING],
          supplierId: washingSupplierId,
          notes:
            csvRow.washingVendor && !washingSupplierId
              ? `Vendor: ${csvRow.washingVendor}${washingNotes ? ` | ${washingNotes}` : ''}`
              : washingNotes || null,
          createdAt: new Date(),
        },
      });
      processesCreated++;
    }

    return processesCreated;
  }

  /**
   * Generate fabric code
   */
  private generateFabricCode(styleCode: string, componentName: string, sequence: number): string {
    const safeComponentName = componentName || 'COMPONENT';
    const componentAbbr = safeComponentName.toUpperCase().replace(/\s+/g, '').substring(0, 10);
    const seq = sequence.toString().padStart(3, '0');
    return `${styleCode}-${componentAbbr}-${seq}`;
  }

  /**
   * Generate fabric name
   */
  private generateFabricName(fabricDescription: string, styleCode: string, componentName: string): string {
    return `${fabricDescription} - ${styleCode} ${componentName}`;
  }

  /**
   * Get component type from component name
   */
  private getComponentType(componentName: string): string {
    if (!componentName || typeof componentName !== 'string') {
      return 'OTHER';
    }

    const name = componentName.toUpperCase();

    if (name.includes('BODY')) return 'BODY';
    if (name.includes('SLEEVE')) return 'SLEEVE';
    if (name.includes('COLLAR')) return 'COLLAR';
    if (name.includes('POCKET')) return 'POCKET';
    if (name.includes('CUFF')) return 'CUFF';
    if (name.includes('YOKE')) return 'YOKE';
    if (name.includes('PALAZZO') || name.includes('PANT')) return 'BOTTOM';
    if (name.includes('DUPATTA') || name.includes('SCARF')) return 'DUPATTA';
    if (name.includes('LINING')) return 'LINING';

    return 'OTHER';
  }

  /**
   * Update staging records status
   */
  private async updateStagingRecords(rows: StyleImportRow[], status: string, styleId?: string, errorMessage?: string) {
    for (const row of rows) {
      await prisma.style_import_staging.updateMany({
        where: {
          styleCode: row.styleCode,
          componentName: row.componentName,
          fabricDescription: row.fabricDescription,
          status: { not: 'PROCESSED' }, // Don't update already processed records
        },
        data: {
          status,
          createdStyleId: styleId,
          errorMessage: errorMessage || null,
        },
      });
    }
  }

  /**
   * Get import status
   */
  async getImportStatus(importBatchId: string) {
    const stagingRecords = await prisma.style_import_staging.findMany({
      where: { importBatchId },
    });

    const summary = {
      total: stagingRecords.length,
      pending: stagingRecords.filter((r) => r.status === 'PENDING').length,
      processed: stagingRecords.filter((r) => r.status === 'PROCESSED').length,
      error: stagingRecords.filter((r) => r.status === 'ERROR').length,
    };

    const errors = stagingRecords
      .filter((r) => r.status === 'ERROR')
      .map((r) => ({
        styleCode: r.styleCode,
        componentName: r.componentName,
        fabricDescription: r.fabricDescription,
        errorMessage: r.errorMessage || 'Unknown error',
      }));

    return {
      importBatchId,
      summary,
      errors,
    };
  }

  /**
   * Retry failed imports
   */
  async retryFailedImports(importBatchId: string, userId: string) {
    const failedRecords = await prisma.style_import_staging.findMany({
      where: {
        importBatchId,
        status: 'ERROR',
      },
    });

    if (failedRecords.length === 0) {
      return {
        success: true,
        message: 'No failed records to retry',
      };
    }

    // Convert back to CSV format and reprocess
    // Note: The staging table may not have all new required fields (brandName, size)
    // These will use fallback values - consider migrating staging table schema
    const csvRows: StyleImportCSVRow[] = failedRecords.map((r) => {
      // Try to extract brand from category or use fallback
      const brandName = r.category || 'Unknown Brand';
      // Size is not in staging - this may cause validation errors on retry
      const size = 'M'; // Default size for legacy retries

      return {
        // Required fields
        styleCode: r.styleCode,
        customerName: r.customer || 'Unknown Customer',
        brandName,
        size,
        // Optional fields
        styleName: r.itemDescription || undefined,
        projectGroup: r.projectGroup || undefined,
        itemDescription: r.itemDescription,
        customer: r.customer || undefined,
        season: r.season || undefined,
        gender: r.gender || undefined,
        category: r.category || undefined,
        componentName: r.componentName,
        fabricDescription: r.fabricDescription,
        cadAverage: r.cadAverage ? r.cadAverage.toNumber() : undefined,
        lastProductionAverage: r.lastProductionAverage ? r.lastProductionAverage.toNumber() : undefined,
        fabricWidth: r.fabricWidth ? r.fabricWidth.toNumber() : undefined,
      };
    });

    return await this.importStylesFromCSV(csvRows, importBatchId, userId);
  }

  /**
   * Process and create variants for a style from CSV rows
   * Updated to auto-generate SKU from styleCode + size
   */
  private async processStyleVariants(styleId: string, styleCode: string, rows: StyleImportRow[]): Promise<number> {
    // Extract unique size combinations from rows
    // Each row with a size should create a variant
    const variantMap = new Map<string, StyleVariantData>();

    for (const row of rows) {
      // Use the size field (required in new format)
      const size = row.size?.trim();
      if (!size) continue;

      // Generate SKU from styleCode + size
      const sku = row.sku || this.generateSKU(styleCode, size);
      const barcode = row.barcode || sku; // Same as SKU

      // Use size as key to deduplicate
      if (!variantMap.has(size.toUpperCase())) {
        variantMap.set(size.toUpperCase(), {
          sku,
          sizeName: size,
          colorName: undefined, // Color is not used for variants (colorways are separate styles)
          barcode,
        });
      }
    }

    // If no sizes found, skip variant creation
    if (variantMap.size === 0) {
      logWarn(`No sizes found for style ${styleCode}, skipping variant creation`);
      return 0;
    }

    // Convert map to array and sort by size order
    const variants = Array.from(variantMap.values()).sort((a, b) => {
      const orderA = this.getSizeOrder(a.sizeName || '');
      const orderB = this.getSizeOrder(b.sizeName || '');
      return orderA - orderB;
    });

    logDebug(
      `Creating ${variants.length} variants for style ${styleCode}: ${variants.map((v) => v.sizeName).join(', ')}`
    );

    // Find or create size options and link them
    for (const variant of variants) {
      if (variant.sizeName) {
        const sizeId = await StyleVariantService.findOrCreateSize(styleId, variant.sizeName);
        variant.sizeId = sizeId || undefined;
      }
    }

    // Create/update variants
    return await StyleVariantService.upsertStyleVariants(styleId, variants);
  }
}

export default new StyleImportService();
