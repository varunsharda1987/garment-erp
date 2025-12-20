import { Request, Response } from 'express';
import { ProductionStage, SampleType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
import { serializeData } from '../utils/serializer';

const prisma = new PrismaClient();

/**
 * Check if a stage transition is allowed
 * GET /api/stage-validation/check?workOrderId=xxx&targetStage=IN_CUTTING
 */
export const checkStageTransition = async (req: Request, res: Response) => {
  try {
    const { workOrderId, targetStage } = req.query;

    if (!workOrderId || !targetStage) {
      return res.status(400).json({
        error: 'Missing required parameters: workOrderId and targetStage',
      });
    }

    const validation = await productionBlockingValidationService.validateStageTransition(
      workOrderId as string,
      targetStage as ProductionStage,
      false // Not checking for override, just validation
    );

    res.json({
      data: serializeData({
        isBlocked: validation.isBlocked,
        blockers: validation.blockers,
        canProceed: !validation.isBlocked,
      }),
    });
  } catch (error: any) {
    console.error('Error checking stage transition:', error);
    res.status(500).json({
      error: 'Failed to check stage transition',
      message: error.message,
    });
  }
};

/**
 * Check if sample creation is allowed (sequential dependency validation)
 * GET /api/stage-validation/check-sample-creation?styleId=xxx&sampleType=PP_SAMPLE
 */
export const checkSampleCreation = async (req: Request, res: Response) => {
  try {
    const { styleId, sampleType } = req.query;

    if (!styleId || !sampleType) {
      return res.status(400).json({
        error: 'Missing required parameters: styleId and sampleType',
      });
    }

    let validation;

    if (sampleType === 'PP_SAMPLE') {
      validation = await productionBlockingValidationService.validatePPSampleCreation(styleId as string);
    } else if (sampleType === 'SIZE_SET_SAMPLE') {
      validation = await productionBlockingValidationService.validateSizeSetSampleCreation(styleId as string);
    } else {
      // No validation needed for other sample types (FIT_SAMPLE, SHIPMENT_SAMPLE, etc.)
      return res.json({
        data: serializeData({
          canCreate: true,
          blocker: null,
        }),
      });
    }

    res.json({ data: serializeData(validation) });
  } catch (error: any) {
    console.error('Error checking sample creation:', error);
    res.status(500).json({
      error: 'Failed to check sample creation',
      message: error.message,
    });
  }
};

/**
 * Get override history (admin only)
 * GET /api/stage-validation/override-history?workOrderId=xxx&sampleId=xxx&limit=50
 */
export const getOverrideHistory = async (req: Request, res: Response) => {
  try {
    const { workOrderId, sampleId, limit = '50' } = req.query;

    const overrides = await prisma.stage_transition_overrides.findMany({
      where: {
        ...(workOrderId && { workOrderId: workOrderId as string }),
        ...(sampleId && { sampleId: sampleId as string }),
      },
      include: {
        overriddenBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            workOrderNumber: true,
          },
        },
        sample: {
          select: {
            id: true,
            sampleNumber: true,
            sampleType: true,
          },
        },
      },
      orderBy: { overriddenAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({ data: serializeData(overrides) });
  } catch (error: any) {
    console.error('Error fetching override history:', error);
    res.status(500).json({
      error: 'Failed to fetch override history',
      message: error.message,
    });
  }
};
