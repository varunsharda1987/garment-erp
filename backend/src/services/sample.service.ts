import prisma from '../config/database';
import { randomUUID } from 'crypto';
import { logInfo, logWarn } from '../utils/logger';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import type { SampleType, SampleStatus, Prisma } from '@prisma/client';

/**
 * Sample Service
 * Business logic for sample management including auto-creation
 */

// Sample type to days-before-ship mapping
const SAMPLE_LEAD_DAYS: Record<SampleType, number> = {
  FIT_SAMPLE: 21,        // 3 weeks before ship
  PP_SAMPLE: 14,         // 2 weeks before ship
  SIZE_SET_SAMPLE: 10,   // 10 days before ship
  PHOTO_SAMPLE: 7,       // 1 week before ship
  PRODUCTION_SAMPLE: 5,  // 5 days before ship
  SHIPMENT_SAMPLE: 3,    // 3 days before ship
};

// Default fallback if customer has no requirements defined
const DEFAULT_REQUIRED_TYPES: SampleType[] = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];

interface AutoCreateResult {
  created: Array<{
    sampleId: string;
    sampleNumber: string;
    styleId: string;
    sampleType: SampleType;
    requiredDate: Date;
  }>;
  skipped: Array<{
    styleId: string;
    sampleType: SampleType;
    reason: string;
  }>;
}

interface CustomerSampleRequirement {
  sampleType: SampleType;
  isRequired: boolean;
  blocksProduction: boolean;
  targetDaysToSend: number | null;
  targetDaysToFeedback: number | null;
}

class SampleService {
  /**
   * Generate sample number using atomic sequence
   */
  private async generateSampleNumber(sampleType: string): Promise<string> {
    const docPrefix = sampleType.replace('_SAMPLE', '').replace(/_/g, '');
    return generateAtomicDocNumber(docPrefix);
  }

  /**
   * Calculate required date based on ship date and sample type
   */
  private calculateRequiredDate(shipDate: Date, sampleType: SampleType): Date {
    const leadDays = SAMPLE_LEAD_DAYS[sampleType] || 7;
    const requiredDate = new Date(shipDate);
    requiredDate.setDate(requiredDate.getDate() - leadDays);

    // Don't set a required date in the past - use today + 3 days minimum
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 3);

    return requiredDate > minDate ? requiredDate : minDate;
  }

  /**
   * Get customer's sample requirements
   * Falls back to defaults if none configured
   */
  async getCustomerSampleRequirements(customerId: string): Promise<CustomerSampleRequirement[]> {
    const requirements = await prisma.customer_sample_requirements.findMany({
      where: { customerId },
    });

    if (requirements.length === 0) {
      // No custom requirements - return defaults (FIT, PP, SIZE_SET all required)
      return DEFAULT_REQUIRED_TYPES.map(sampleType => ({
        sampleType,
        isRequired: true,
        blocksProduction: true,
        targetDaysToSend: null,
        targetDaysToFeedback: null,
      }));
    }

    return requirements.map(r => ({
      sampleType: r.sampleType,
      isRequired: r.isRequired,
      blocksProduction: r.blocksProduction,
      targetDaysToSend: r.targetDaysToSend,
      targetDaysToFeedback: r.targetDaysToFeedback,
    }));
  }

  /**
   * Check if a sample already exists for a style and type
   */
  async sampleExists(styleId: string, sampleType: SampleType): Promise<boolean> {
    const count = await prisma.samples.count({
      where: { styleId, sampleType },
    });
    return count > 0;
  }

  /**
   * Get existing samples for multiple styles
   */
  async getExistingSamples(styleIds: string[], sampleTypes: SampleType[]): Promise<Set<string>> {
    const existing = await prisma.samples.findMany({
      where: {
        styleId: { in: styleIds },
        sampleType: { in: sampleTypes },
      },
      select: { styleId: true, sampleType: true },
    });

    // Return a Set of "styleId:sampleType" keys for fast lookup
    return new Set(existing.map(s => `${s.styleId}:${s.sampleType}`));
  }

  /**
   * Auto-create samples for styles in an order based on customer requirements
   *
   * @param orderId - The sale order or production order ID (for audit trail)
   * @param customerId - The customer ID
   * @param styleIds - Array of style IDs from the order items
   * @param shipDate - Expected delivery/ship date of the order
   * @param createdById - User ID creating the samples
   * @param orderType - 'SALE_ORDER' or 'PRODUCTION_ORDER' for logging
   */
  async autoCreateSamplesForOrder(
    orderId: string,
    customerId: string,
    styleIds: string[],
    shipDate: Date,
    createdById: string,
    orderType: 'SALE_ORDER' | 'PRODUCTION_ORDER' = 'SALE_ORDER'
  ): Promise<AutoCreateResult> {
    const result: AutoCreateResult = { created: [], skipped: [] };

    if (styleIds.length === 0) {
      logWarn('[autoCreateSamples] No styleIds provided');
      return result;
    }

    // 1. Get customer's sample requirements
    const requirements = await this.getCustomerSampleRequirements(customerId);
    const requiredTypes = requirements
      .filter(r => r.isRequired)
      .map(r => r.sampleType);

    if (requiredTypes.length === 0) {
      logInfo('[autoCreateSamples] No required sample types for customer', { customerId });
      return result;
    }

    // 2. Get existing samples to avoid duplicates
    const existingSamples = await this.getExistingSamples(styleIds, requiredTypes);

    // 3. Build list of samples to create
    const samplesToCreate: Array<{
      styleId: string;
      sampleType: SampleType;
      requiredDate: Date;
    }> = [];

    for (const styleId of styleIds) {
      for (const sampleType of requiredTypes) {
        const key = `${styleId}:${sampleType}`;

        if (existingSamples.has(key)) {
          result.skipped.push({
            styleId,
            sampleType,
            reason: 'already_exists',
          });
          continue;
        }

        samplesToCreate.push({
          styleId,
          sampleType,
          requiredDate: this.calculateRequiredDate(shipDate, sampleType),
        });
      }
    }

    if (samplesToCreate.length === 0) {
      logInfo('[autoCreateSamples] All samples already exist', { orderId, orderType });
      return result;
    }

    // 4. Create samples in a transaction
    // Pre-generate sample numbers outside transaction (atomic, safe)
    const sampleNumbers = await Promise.all(
      samplesToCreate.map(s => this.generateSampleNumber(s.sampleType))
    );

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < samplesToCreate.length; i++) {
        const { styleId, sampleType, requiredDate } = samplesToCreate[i];
        const sampleNumber = sampleNumbers[i];

        // Determine version for versioned sample types
        let version = 1;
        if (['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'].includes(sampleType)) {
          const maxVersion = await tx.samples.aggregate({
            where: { styleId, sampleType },
            _max: { version: true },
          });
          version = (maxVersion._max.version || 0) + 1;
        }

        const sampleId = randomUUID();

        await tx.samples.create({
          data: {
            id: sampleId,
            sampleNumber,
            customerId,
            styleId,
            sampleType,
            requestDate: new Date(),
            requiredDate,
            status: 'REQUESTED',
            remarks: `Auto-created from ${orderType === 'SALE_ORDER' ? 'Sale Order' : 'Production Order'} confirmation`,
            createdById,
            version,
          },
        });

        result.created.push({
          sampleId,
          sampleNumber,
          styleId,
          sampleType,
          requiredDate,
        });
      }
    });

    logInfo('[autoCreateSamples] Samples auto-created', {
      orderId,
      orderType,
      customerId,
      created: result.created.length,
      skipped: result.skipped.length,
    });

    return result;
  }

  /**
   * Quick status update for inline actions
   */
  async quickStatusUpdate(
    sampleId: string,
    data: {
      status: SampleStatus;
      sentDate?: Date;
      completionDate?: Date;
    }
  ): Promise<void> {
    const updateData: Prisma.samplesUpdateInput = {
      status: data.status,
    };

    if (data.status === 'SENT' && data.sentDate) {
      updateData.sentDate = data.sentDate;
    }

    if (data.status === 'SUBMITTED' && data.completionDate) {
      updateData.completionDate = data.completionDate;
    }

    await prisma.samples.update({
      where: { id: sampleId },
      data: updateData,
    });
  }
}

export const sampleService = new SampleService();
