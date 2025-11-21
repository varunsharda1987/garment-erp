// Style Import Service
// Handles bulk import of styles with fabrics from CSV

import { PrismaClient, Gender, Prisma } from '@prisma/client';
import {
  StyleImportRow,
  StyleImportCSVRow,
  StyleImportResponse,
  ImportSummary,
  StyleImportError,
  FabricToCreate,
  StyleToCreate,
  ComponentToCreate,
  STYLE_IMPORT_VALIDATION_RULES,
} from '../types/style-import.types';

const prisma = new PrismaClient();

export class StyleImportService {
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
      processingTimeMs: 0,
    };
    const errors: StyleImportError[] = [];

    try {
      // Step 1: Validate and parse CSV rows
      const validatedRows = await this.validateAndParseRows(csvRows, importBatchId);

      // Step 2: Group rows by style code
      const styleGroups = this.groupRowsByStyle(validatedRows);

      // Step 3: Process each style
      for (const [styleCode, rows] of Object.entries(styleGroups)) {
        try {
          const firstRow = rows[0];

          // Check if style exists
          const existingStyle = await prisma.styles.findUnique({
            where: { styleCode },
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
          const style = await this.createOrUpdateStyle(
            firstRow,
            userId,
            existingStyle ? true : false
          );

          if (existingStyle) {
            summary.stylesUpdated++;
          } else {
            summary.stylesCreated++;
          }

          // Process components and fabrics for this style
          const componentMap = await this.processComponentsAndFabrics(
            style.id,
            styleCode,
            rows,
            userId
          );

          summary.componentsCreated += componentMap.componentsCreated;
          summary.fabricsCreated += componentMap.fabricsCreated;
          summary.cadEntriesCreated += componentMap.cadEntriesCreated;
          summary.successCount += rows.length;

          // Update staging table
          await this.updateStagingRecords(rows, 'PROCESSED', style.id);
        } catch (error: any) {
          // Handle errors for this style
          console.error(`Error processing style ${styleCode}:`, error);
          errors.push({
            rowNumber: 0,
            styleCode,
            componentName: '',
            fabricDescription: '',
            errorMessage: error.message || 'Unknown error',
            errorType: 'DATABASE',
          });
          summary.errorCount += rows.length;

          // Update staging table with error
          await this.updateStagingRecords(rows, 'ERROR', undefined, error.message);
        }
      }

      summary.processingTimeMs = Date.now() - startTime;

      return {
        success: summary.errorCount === 0,
        importBatchId,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error('Style import failed:', error);
      throw new Error(`Style import failed: ${error.message}`);
    }
  }

  /**
   * Validate and parse CSV rows, insert into staging table
   */
  private async validateAndParseRows(
    csvRows: StyleImportCSVRow[],
    importBatchId: string
  ): Promise<StyleImportRow[]> {
    const validatedRows: StyleImportRow[] = [];

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const validationErrors: string[] = [];

      // Run validation rules
      for (const rule of STYLE_IMPORT_VALIDATION_RULES) {
        const fieldValue = (row as any)[rule.field];
        if (!rule.validate(fieldValue, row)) {
          validationErrors.push(rule.message);
        }
      }

      // Parse numbers
      const cadAverage =
        typeof row.cadAverage === 'string'
          ? parseFloat(row.cadAverage)
          : row.cadAverage;
      const lastProductionAverage =
        typeof row.lastProductionAverage === 'string'
          ? parseFloat(row.lastProductionAverage)
          : row.lastProductionAverage;
      const fabricWidth =
        typeof row.fabricWidth === 'string'
          ? parseFloat(row.fabricWidth)
          : row.fabricWidth;

      // Parse gender enum - map to Prisma enum values
      let gender: Gender | undefined;
      if (row.gender && typeof row.gender === 'string') {
        const genderUpper = row.gender.toUpperCase();
        // Map common gender values to Prisma Gender enum
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

      // Generate fabric code and name
      const generatedFabricCode = this.generateFabricCode(
        row.styleCode,
        row.componentName,
        1
      );
      const generatedFabricName = this.generateFabricName(
        row.fabricDescription,
        row.styleCode,
        row.componentName
      );

      const validatedRow: StyleImportRow = {
        ...row,
        cadAverage,
        lastProductionAverage,
        fabricWidth,
        gender,
        generatedFabricCode,
        generatedFabricName,
        isValid: validationErrors.length === 0,
        validationErrors,
      };

      validatedRows.push(validatedRow);

      // Insert into staging table
      await prisma.style_import_staging.create({
        data: {
          styleCode: row.styleCode || '',
          projectGroup: row.projectGroup,
          itemDescription: row.itemDescription || '',
          customer: row.customer,
          season: row.season,
          gender: row.gender,
          category: row.category,
          componentName: row.componentName || '',
          fabricDescription: row.fabricDescription || '',
          cadAverage: cadAverage ? new Prisma.Decimal(cadAverage) : null,
          lastProductionAverage: lastProductionAverage
            ? new Prisma.Decimal(lastProductionAverage)
            : null,
          fabricWidth: fabricWidth ? new Prisma.Decimal(fabricWidth) : null,
          generatedFabricCode,
          generatedFabricName,
          importBatchId,
          status: validationErrors.length > 0 ? 'ERROR' : 'PENDING',
          errorMessage:
            validationErrors.length > 0 ? validationErrors.join('; ') : null,
        },
      });
    }

    // Filter out invalid rows
    return validatedRows.filter((row) => row.isValid);
  }

  /**
   * Group rows by style code
   */
  private groupRowsByStyle(
    rows: StyleImportRow[]
  ): Record<string, StyleImportRow[]> {
    return rows.reduce((groups, row) => {
      if (!groups[row.styleCode]) {
        groups[row.styleCode] = [];
      }
      groups[row.styleCode].push(row);
      return groups;
    }, {} as Record<string, StyleImportRow[]>);
  }

  /**
   * Create or update style record
   */
  private async createOrUpdateStyle(
    row: StyleImportRow,
    userId: string,
    isUpdate: boolean
  ) {
    const styleData = {
      styleCode: row.styleCode,
      styleName: row.itemDescription,
      buyerName: row.customer,
      projectGroup: row.projectGroup,
      season: row.season,
      gender: row.gender,
      description: row.category,
      isActive: true,
      createdById: userId,
      updatedAt: new Date(),
    };

    if (isUpdate) {
      return await prisma.styles.update({
        where: { styleCode: row.styleCode },
        data: styleData,
      });
    } else {
      return await prisma.styles.create({
        data: {
          ...styleData,
          id: `${row.styleCode}-${Date.now()}`,
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
    const componentGroups = rows.reduce((groups, row) => {
      if (!groups[row.componentName]) {
        groups[row.componentName] = [];
      }
      groups[row.componentName].push(row);
      return groups;
    }, {} as Record<string, StyleImportRow[]>);

    // Process each component
    for (const [componentName, componentRows] of Object.entries(
      componentGroups
    )) {
      // Create component
      const component = await prisma.style_components.create({
        data: {
          id: `${styleId}-${componentName}-${Date.now()}`,
          styleId,
          componentName,
          componentType: this.getComponentType(componentName),
          sortOrder: componentsCreated + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      componentsCreated++;

      // Check for duplicate fabrics within the same component
      const uniqueFabrics = new Map<string, StyleImportRow>();
      for (const row of componentRows) {
        // Use fabric description as key for deduplication
        if (!uniqueFabrics.has(row.fabricDescription)) {
          uniqueFabrics.set(row.fabricDescription, row);
        }
      }

      // Create fabrics
      let fabricSequence = 1;
      for (const row of uniqueFabrics.values()) {
        try {
          // Get or create greige (for now, we'll create a generic greige)
          const greigeId = await this.getOrCreateGreige(
            row.fabricDescription,
            userId
          );

          // Generate fabric code
          const fabricCode = this.generateFabricCode(
            styleCode,
            componentName,
            fabricSequence
          );
          const fabricName = this.generateFabricName(
            row.fabricDescription,
            styleCode,
            componentName
          );

          // Create fabric
          const fabric = await prisma.fabric_master.create({
            data: {
              id: `${fabricCode}-${Date.now()}`,
              fabricCode,
              fabricName,
              greigeId,
              description: row.fabricDescription,
              actualWidth: row.fabricWidth
                ? new Prisma.Decimal(row.fabricWidth)
                : new Prisma.Decimal(58), // Default 58 inches
              styleReference: styleCode,
              isGeneric: false,
              componentType: componentName,
              isActive: true,
              createdById: userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
          fabricsCreated++;
          fabricSequence++;

          // Create CAD entry
          if (row.fabricWidth) {
            const cadVariancePercent =
              row.cadAverage && row.lastProductionAverage
                ? ((row.lastProductionAverage - row.cadAverage) / row.cadAverage) *
                  100
                : null;

            await prisma.fabric_width_cad.create({
              data: {
                id: `${fabric.id}-CAD-${Date.now()}`,
                fabricId: fabric.id,
                availableWidth: new Prisma.Decimal(row.fabricWidth),
                cadMeters: row.cadAverage
                  ? new Prisma.Decimal(row.cadAverage)
                  : null,
                actualCad: row.lastProductionAverage
                  ? new Prisma.Decimal(row.lastProductionAverage)
                  : null,
                cadVariancePercent: cadVariancePercent
                  ? new Prisma.Decimal(cadVariancePercent)
                  : null,
                cadWastagePercent: new Prisma.Decimal(5), // Default 5%
                isPreferred: true, // Mark as preferred width
                createdById: userId,
                createdAt: new Date(),
                updatedAt: new Date(),
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
              quantityNeeded: row.cadAverage
                ? new Prisma.Decimal(row.cadAverage)
                : null,
            },
          });
        } catch (error: any) {
          console.error(`Error creating fabric for ${componentName}:`, error);
          // Continue with next fabric
        }
      }
    }

    return { componentsCreated, fabricsCreated, cadEntriesCreated };
  }

  /**
   * Get or create greige fabric
   * For now, creates a generic greige based on fabric description
   */
  private async getOrCreateGreige(
    fabricDescription: string,
    userId: string
  ): Promise<string> {
    // Try to find existing greige by name
    const existing = await prisma.greige_master.findFirst({
      where: {
        greigeName: {
          contains: fabricDescription,
          mode: 'insensitive',
        },
      },
    });

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
        greigeName: fabricDescription,
        composition: 'To be specified', // Will be updated later
        greigeWidth: new Prisma.Decimal(58), // Default 58 inches
        isActive: true,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return greige.id;
  }

  /**
   * Generate fabric code
   */
  private generateFabricCode(
    styleCode: string,
    componentName: string,
    sequence: number
  ): string {
    const safeComponentName = componentName || 'COMPONENT';
    const componentAbbr = safeComponentName
      .toUpperCase()
      .replace(/\s+/g, '')
      .substring(0, 10);
    const seq = sequence.toString().padStart(3, '0');
    return `${styleCode}-${componentAbbr}-${seq}`;
  }

  /**
   * Generate fabric name
   */
  private generateFabricName(
    fabricDescription: string,
    styleCode: string,
    componentName: string
  ): string {
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
  private async updateStagingRecords(
    rows: StyleImportRow[],
    status: string,
    styleId?: string,
    errorMessage?: string
  ) {
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
    const csvRows: StyleImportCSVRow[] = failedRecords.map((r) => ({
      styleCode: r.styleCode,
      projectGroup: r.projectGroup || undefined,
      itemDescription: r.itemDescription,
      customer: r.customer || undefined,
      season: r.season || undefined,
      gender: r.gender || undefined,
      category: r.category || undefined,
      componentName: r.componentName,
      fabricDescription: r.fabricDescription,
      cadAverage: r.cadAverage ? r.cadAverage.toNumber() : undefined,
      lastProductionAverage: r.lastProductionAverage
        ? r.lastProductionAverage.toNumber()
        : undefined,
      fabricWidth: r.fabricWidth ? r.fabricWidth.toNumber() : undefined,
    }));

    return await this.importStylesFromCSV(csvRows, importBatchId, userId);
  }
}

export default new StyleImportService();
